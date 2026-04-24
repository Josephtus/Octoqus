"""
src/routes/groups.py
====================
Grup Yönetimi Blueprint
/api/groups prefix'i ile çalışır.

Endpoints:
  POST /api/groups                                          → Grup oluştur
  GET  /api/groups                                          → Onaylı grupları listele
  POST /api/groups/<group_id>/join                          → Gruba katılma isteği
  POST /api/groups/<group_id>/approve/<user_id>             → Üyeyi onayla (Lider)
  POST /api/groups/<group_id>/transfer_leadership/<target>  → Liderliği devret
  POST /api/groups/<group_id>/leave                         → Gruptan ayrıl

İş Kuralları:
  - Grup oluşturulduğunda is_approved=False (Admin onayı bekler)
  - Kurucu GroupLeader olarak is_approved=True ile eklenir
  - Katılma isteği is_approved=False olarak eklenir
  - Yalnızca o grubun GROUP_LEADER'ı (is_approved=True) üye onaylayabilir
  - Lider ayrılırsa en eski onaylı üye otomatik lider olur
"""

import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, Forbidden, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import asc, select
from sqlalchemy.orm import selectinload

from src.database import get_session
from src.models import Group, GroupMember, GroupMemberRole, User, GroupBan
from src.services.security import protected

logger = structlog.get_logger(__name__)

groups_bp = Blueprint("groups", url_prefix="/api/groups")


# =============================================================================
# Pydantic Şemaları
# =============================================================================

class CreateGroupRequest(BaseModel):
    """Grup oluşturma isteği."""

    name: str
    content: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Grup adı boş olamaz.")
        if len(v) > 200:
            raise ValueError("Grup adı en fazla 200 karakter olabilir.")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip() or None
        return v


class UpdateGroupRequest(BaseModel):
    """Grup profilini düzenleme isteği (partial update)."""
    name: str | None = None
    content: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Grup adı boş olamaz.")
            if len(v) > 200:
                raise ValueError("Grup adı en fazla 200 karakter olabilir.")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip() or None
        return v


# =============================================================================
# Helpers
# =============================================================================

def _build_group_response(group: Group) -> dict:
    """Group nesnesini API response dict'ine dönüştürür."""
    return {
        "id": group.id,
        "name": group.name,
        "content": group.content,
        "is_approved": group.is_approved,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def _build_member_response(member: GroupMember) -> dict:
    """GroupMember nesnesini API response dict'ine dönüştürür."""
    return {
        "user_id": member.user_id,
        "group_id": member.group_id,
        "role": member.role.value,
        "is_approved": member.is_approved,
        "joined_at": member.joined_at.isoformat() if member.joined_at else None,
    }


async def _get_approved_group(session, group_id: int) -> Group:
    """
    Onaylanmış (is_approved=True) grubu getirir.
    Bulunamazsa veya onaylanmamışsa 404 fırlatır.
    """
    stmt = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
    group = await session.scalar(stmt)
    if not group:
        raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")
    return group


async def _get_leader_membership(session, group_id: int, user_id: int) -> GroupMember:
    """
    Belirtilen kullanıcının bu grupta aktif GROUP_LEADER olup olmadığını kontrol eder.
    Değilse 403 Forbidden fırlatır.
    """
    stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.role == GroupMemberRole.GROUP_LEADER,
        GroupMember.is_approved.is_(True),
    )
    membership = await session.scalar(stmt)
    if not membership:
        raise Forbidden("Bu işlemi yalnızca grubun onaylı lideri yapabilir.")
    return membership


async def _get_membership(session, group_id: int, user_id: int) -> GroupMember | None:
    """Bir kullanıcının gruptaki üyelik kaydını döner (yoksa None)."""
    stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    )
    return await session.scalar(stmt)


# =============================================================================
# ENDPOINT 1: POST /api/groups — Grup Oluşturma
# =============================================================================

@groups_bp.post("/")
@protected
async def create_group(request: Request) -> HTTPResponse:
    """
    Yeni grup oluşturur.

    İş Kuralları:
      - Grup `is_approved=False` olarak oluşturulur (Admin onayı gerekir).
      - Kurucusu GroupMember'a `role=GROUP_LEADER`, `is_approved=True` ile eklenir.

    Request Body (JSON):
        name   : str (zorunlu)
        content: str | null (opsiyonel)

    Responses:
        201 → Grup oluşturuldu, lider olarak eklendi
        400 → Validasyon hatası
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = CreateGroupRequest.model_validate(body)
    except ValidationError as exc:
        errors = [
            {"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]}
            for e in exc.errors()
        ]
        raise BadRequest(f"Validasyon hatası: {errors}")

    creator_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grubu oluştur (Admin onayı bekleyecek)
        new_group = Group(
            name=data.name,
            content=data.content,
            is_approved=False,
        )
        session.add(new_group)
        await session.flush()  # ID al

        # Kurucuyu GROUP_LEADER olarak ve onaylı şekilde ekle
        leader_membership = GroupMember(
            user_id=creator_id,
            group_id=new_group.id,
            role=GroupMemberRole.GROUP_LEADER,
            is_approved=True,  # Kurucu direkt onaylı lider
        )
        session.add(leader_membership)

        # Commit and refresh to ensure server-side fields (like created_at) are loaded
        await session.commit()
        await session.refresh(new_group)
        await session.refresh(leader_membership)

        logger.info(
            "group.created",
            group_id=new_group.id,
            creator_id=creator_id,
        )

        return sanic_json(
            {
                "message": "Grup oluşturma isteği alındı. Admin onayı bekleniyor.",
                "group": _build_group_response(new_group),
                "your_membership": _build_member_response(leader_membership),
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 2: GET /api/groups — Onaylı Grupları Listele
# =============================================================================

@groups_bp.get("/")
@protected
async def list_groups(request: Request) -> HTTPResponse:
    """
    Admin tarafından onaylanmış tüm grupları listeler.
    Kullanıcıların katılacak grup bulabilmesi için herkese açıktır (token gerekli).

    Query Parameters (opsiyonel):
        page  : int (default: 1)
        limit : int (default: 20, max: 100)

    Responses:
        200 → Onaylı grupların listesi (pagination ile)
    """
    # Basit pagination
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20

    offset = (page - 1) * limit
    user_id: int = int(request.ctx.user["sub"])
    query = request.args.get("q", "").strip()

    async with get_session() as session:
        from sqlalchemy import func
        # Toplam sayıyı al
        count_stmt = select(func.count(Group.id)).where(Group.is_approved.is_(True))
        if query:
            count_stmt = count_stmt.where(Group.name.ilike(f"%{query}%"))
        total_count = await session.scalar(count_stmt) or 0

        # Join with GroupMember to see if the current user is a member
        stmt = (
            select(Group, GroupMember)
            .outerjoin(
                GroupMember,
                (GroupMember.group_id == Group.id) & (GroupMember.user_id == user_id)
            )
            .where(Group.is_approved.is_(True))
        )
        
        if query:
            stmt = stmt.where(Group.name.ilike(f"%{query}%"))
            
        # Öncelik: Üyesi olduğu gruplar en üstte, sonra en yeni gruplar
        stmt = stmt.order_by(
            GroupMember.id.isnot(None).desc(),
            Group.created_at.desc()
        ).offset(offset).limit(limit)
        result = await session.execute(stmt)
        
        data_list = []
        for group, membership in result:
            g_dict = _build_group_response(group)
            if membership:
                g_dict["role"] = membership.role.value
                # Membership status overrides group approval status in this context for the UI
                g_dict["is_approved"] = membership.is_approved
            data_list.append(g_dict)

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "total_count": total_count,
                "count": len(data_list),
                "groups": data_list,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 2.5: GET /api/groups/<group_id> — Grup Detaylarını Getir
# =============================================================================

@groups_bp.get("/<group_id:int>")
@protected
async def get_group_details(request: Request, group_id: int) -> HTTPResponse:
    """
    Belirtilen grubun temel bilgilerini (ad, açıklama vb.) döner.
    """
    async with get_session() as session:
        group = await _get_approved_group(session, group_id)
        return sanic_json(_build_group_response(group), status=200)


# =============================================================================
# ENDPOINT 3: POST /api/groups/<group_id>/join — Gruba Katılma İsteği
# =============================================================================

@groups_bp.post("/<group_id:int>/join")
@protected
async def join_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Onaylı bir gruba katılma isteği gönderir.

    İş Kuralları:
      - Yalnızca is_approved=True gruplarına istek gönderilebilir.
      - Kullanıcı zaten üyeyse 400 döner (bekleyen istek de dahil).
      - Yeni üyelik `role=USER`, `is_approved=False` ile eklenir.

    Responses:
        201 → Katılma isteği gönderildi, lider onayı bekleniyor
        400 → Zaten üye veya bekleyen istek var
        404 → Grup bulunamadı
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grup mevcut ve onaylı mı?
        await _get_approved_group(session, group_id)

        # Zaten üye mi?
        existing = await _get_membership(session, group_id, user_id)
        if existing:
            if existing.is_approved:
                raise BadRequest("Bu grubun zaten aktif bir üyesisiniz.")
            else:
                raise BadRequest("Bu grup için zaten bekleyen bir katılma isteğiniz var.")

        # Banlı mı?
        stmt_ban = select(GroupBan).where(GroupBan.group_id == group_id, GroupBan.user_id == user_id)
        is_banned = await session.scalar(stmt_ban)
        if is_banned:
            raise Forbidden("Bu gruptan kalıcı olarak uzaklaştırıldınız (Ban).")

        # Katılma isteği oluştur
        new_membership = GroupMember(
            user_id=user_id,
            group_id=group_id,
            role=GroupMemberRole.USER,
            is_approved=False,   # Lider onayı bekliyor
        )
        session.add(new_membership)

        logger.info("group.join_request", group_id=group_id, user_id=user_id)

        return sanic_json(
            {
                "message": "Katılma isteğiniz alındı. Grup liderinin onayı bekleniyor.",
                "membership": _build_member_response(new_membership),
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 4: POST /api/groups/<group_id>/approve/<user_id> — Üye Onaylama
# =============================================================================

@groups_bp.post("/<group_id:int>/approve/<target_user_id:int>")
@protected
async def approve_member(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Grup liderinin bekleyen katılma isteğini onaylaması.

    Yetki:
        Yalnızca o grubun onaylı GROUP_LEADER'ı yapabilir.

    Responses:
        200 → Üye onaylandı
        400 → Bekleyen istek yok veya zaten onaylı
        403 → Yetkisiz (lider değil)
        404 → Grup veya üye bulunamadı
    """
    requester_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        # Hedef üyenin bekleyen isteğini bul
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
        )
        target_membership = await session.scalar(stmt)

        if not target_membership:
            raise NotFound(
                f"Bu grupta kullanıcı (id={target_user_id}) için bekleyen bir istek bulunamadı."
            )
        if target_membership.is_approved:
            raise BadRequest("Bu kullanıcı zaten grubun onaylı üyesi.")

        target_membership.is_approved = True

        logger.info(
            "group.member_approved",
            group_id=group_id,
            approved_user=target_user_id,
            by_leader=requester_id,
        )

        return sanic_json(
            {
                "message": "Üye başarıyla onaylandı.",
                "membership": _build_member_response(target_membership),
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 5: POST /api/groups/<group_id>/transfer_leadership/<target_user_id>
# =============================================================================

@groups_bp.post("/<group_id:int>/transfer_leadership/<target_user_id:int>")
@protected
async def transfer_leadership(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Grup liderinin liderliğini başka bir onaylı üyeye devretmesi.

    İş Kuralları:
      - Hedef kullanıcı bu grubun onaylı (is_approved=True) üyesi olmalı.
      - Mevcut lider USER rolüne düşürülür.
      - Hedef kullanıcı GROUP_LEADER rolüne yükseltilir.
      - Kendine devir yapılamaz.

    Responses:
        200 → Liderlik devredildi
        400 → Kendine devir veya geçersiz hedef
        403 → Yetkisiz
        404 → Grup veya hedef üye bulunamadı
    """
    requester_id: int = int(request.ctx.user["sub"])

    if requester_id == target_user_id:
        raise BadRequest("Liderliği kendinize deviremezsiniz.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        current_leader_membership = await _get_leader_membership(
            session, group_id, requester_id
        )

        # Hedef kullanıcının onaylı üyeliğini kontrol et
        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
            GroupMember.is_approved.is_(True),
        )
        target_membership = await session.scalar(stmt)

        if not target_membership:
            raise NotFound(
                f"Hedef kullanıcı (id={target_user_id}) bu grubun onaylı üyesi değil."
            )

        # Rol değişimi
        current_leader_membership.role = GroupMemberRole.USER
        target_membership.role = GroupMemberRole.GROUP_LEADER

        logger.info(
            "group.leadership_transferred",
            group_id=group_id,
            from_user=requester_id,
            to_user=target_user_id,
        )

        return sanic_json(
            {
                "message": "Liderlik başarıyla devredildi.",
                "new_leader_user_id": target_user_id,
                "previous_leader_user_id": requester_id,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 6: POST /api/groups/<group_id>/leave — Gruptan Ayrılma
# =============================================================================

@groups_bp.post("/<group_id:int>/leave")
@protected
async def leave_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Kullanıcının gruptan ayrılması.

    İş Kuralları:
      1. Kullanıcı bu grubun üyesi olmalı.
      2. Ayrılan kullanıcı GROUP_LEADER ise:
         a. Başka onaylı üyeler varsa → en eski (joined_at ASC) üye otomatik lider olur.
         b. Başka onaylı üye yoksa → grup sahipsiz kalır (üyelik silinir, grup kaydı tutulur).
      3. Üyelik kaydı kalıcı olarak silinir (GroupMember soft-delete yok).

    Responses:
        200 → Gruptan ayrıldı (gerekirse yeni lider atandı)
        400 → Zaten üye değil
        404 → Grup bulunamadı
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grubun var olduğunu kontrol et (is_approved durumundan bağımsız)
        stmt = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt)
        if not group:
            raise NotFound(f"Grup bulunamadı (id={group_id}).")

        # Kullanıcının üyeliğini bul
        user_membership = await _get_membership(session, group_id, user_id)
        if not user_membership:
            raise BadRequest("Bu grubun üyesi değilsiniz.")

        response_extra: dict = {}

        # ── Lider ayrılıyor → Otomasyon ─────────────────────────────────────
        if user_membership.role == GroupMemberRole.GROUP_LEADER:
            # En eski onaylı üyeyi bul (lider hariç)
            stmt_next = (
                select(GroupMember)
                .where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id != user_id,
                    GroupMember.is_approved.is_(True),
                )
                .order_by(asc(GroupMember.joined_at))
                .limit(1)
            )
            next_leader = await session.scalar(stmt_next)

            if next_leader:
                # Eski üyeyi GROUP_LEADER'a yükselt
                next_leader.role = GroupMemberRole.GROUP_LEADER
                response_extra["new_leader_user_id"] = next_leader.user_id
                response_extra["message_detail"] = (
                    f"Gruptan ayrıldınız. Kullanıcı (id={next_leader.user_id}) "
                    f"yeni grup lideri olarak atandı."
                )
                logger.info(
                    "group.auto_leader_assigned",
                    group_id=group_id,
                    old_leader=user_id,
                    new_leader=next_leader.user_id,
                )
            else:
                # Grup sahipsiz kalacak
                response_extra["message_detail"] = (
                    "Gruptan ayrıldınız. Grupta başka onaylı üye kalmadığı için "
                    "grup lidersiz duruma geçti."
                )
                logger.warning(
                    "group.no_leader_left",
                    group_id=group_id,
                    last_leader=user_id,
                )

        # ── Üyelik kaydını sil ───────────────────────────────────────────────
        await session.delete(user_membership)

        logger.info("group.left", group_id=group_id, user_id=user_id)

        return sanic_json(
            {
                "message": response_extra.get(
                    "message_detail", "Gruptan başarıyla ayrıldınız."
                ),
                **{k: v for k, v in response_extra.items() if k != "message_detail"},
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 7: PUT /api/groups/<group_id> — Grup Profilini Düzenle
# =============================================================================

@groups_bp.put("/<group_id:int>")
@protected
async def update_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Grup profilini (isim ve açıklama) düzenler.
    Yalnızca o grubun onaylı GROUP_LEADER'ı yapabilir.
    """
    requester_id: int = int(request.ctx.user["sub"])
    body = request.json or {}

    if not body:
        raise BadRequest("Güncellenecek alanlar (JSON formatında) gereklidir.")

    try:
        data = UpdateGroupRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    async with get_session() as session:
        group = await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        updated_fields = {}

        if data.name is not None:
            group.name = data.name
            updated_fields["name"] = data.name

        if data.content is not None:
            group.content = data.content
            updated_fields["content"] = data.content

        if not updated_fields:
            return sanic_json({"message": "Değişiklik yapılmadı."}, status=200)

        logger.info(
            "group.updated",
            group_id=group_id,
            leader_id=requester_id,
            updated_fields=list(updated_fields.keys())
        )

        return sanic_json(
            {
                "message": "Grup profili başarıyla güncellendi.",
                "group": _build_group_response(group)
            },
            status=200
        )


# =============================================================================
# ENDPOINT 8: DELETE /api/groups/<group_id>/members/<target_user_id> — Üye Atma
# =============================================================================

@groups_bp.delete("/<group_id:int>/members/<target_user_id:int>")
@protected
async def kick_member(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Gruptan onaylı veya onaysız mevcut bir üyeyi atar (Kick).
    Sadece grubun onaylı GROUP_LEADER'ı yapabilir.
    Kendini atamaz. Üyelik kalıcı silinir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    if requester_id == target_user_id:
        raise BadRequest("Kendinizi atamazsınız, gruptan ayrılmak için leave rotasını kullanın.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        target_membership = await _get_membership(session, group_id, target_user_id)
        if not target_membership:
            raise NotFound("Hedef kullanıcı grubun üyesi değil.")

        await session.delete(target_membership)

        logger.info(
            "group.member_kicked",
            group_id=group_id,
            kicked_user=target_user_id,
            by_leader=requester_id
        )

        return sanic_json({"message": f"Kullanıcı (id={target_user_id}) gruptan atıldı."}, status=200)


# =============================================================================
# ENDPOINT 8.5: GET /api/groups/<group_id>/members — Üyeleri Listele
# =============================================================================

@groups_bp.get("/<group_id:int>/members")
@protected
async def list_group_members(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun üyelerini listeler.
    
    Erişim Kontrolü:
      - İstek atan kullanıcı grupta onaylı üye olmalıdır.
    
    Veri Kısıtı:
      - Eğer liderse: Hem onaylı hem de bekleyen (is_approved=False) üyeleri görür.
      - Eğer üye ise: Sadece onaylı üyeleri görür.
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Onaylı grup var mı?
        await _get_approved_group(session, group_id)

        # İstek atan kullanıcının rolünü ve durumunu bul
        requester_membership = await _get_membership(session, group_id, user_id)
        if not requester_membership or not requester_membership.is_approved:
            raise Forbidden("Grup üyelerini görmek için bu grubun onaylı bir üyesi olmalısınız.")

        is_leader = requester_membership.role == GroupMemberRole.GROUP_LEADER

        # Üyeleri (ve kullanıcı bilgilerini) getir
        stmt = (
            select(GroupMember)
            .options(selectinload(GroupMember.user))
            .where(GroupMember.group_id == group_id)
        )

        # Lider değilse sadece onaylıları görsün
        if not is_leader:
            stmt = stmt.where(GroupMember.is_approved.is_(True))

        stmt = stmt.order_by(GroupMember.joined_at.asc())
        members = list(await session.scalars(stmt))

        return sanic_json({
            "group_id": group_id,
            "count": len(members),
            "members": [
                {
                    "user_id": m.user_id,
                    "name": m.user.name,
                    "surname": m.user.surname,
                    "mail": m.user.mail,
                    "role": m.role.value,
                    "is_approved": m.is_approved,
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None
                }
                for m in members
            ]
        }, status=200)


# =============================================================================
# ENDPOINT 9: DELETE /api/groups/<group_id>/requests/<target_user_id> — İstek Reddet
# =============================================================================

@groups_bp.delete("/<group_id:int>/requests/<target_user_id:int>")
@protected
async def reject_request(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Bekleyen katılma isteğini reddeder.
    Sadece grubun onaylı GROUP_LEADER'ı yapabilir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        stmt = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
            GroupMember.is_approved.is_(False)
        )
        target_membership = await session.scalar(stmt)

        if not target_membership:
            raise NotFound("Hedef kullanıcı için bekleyen bir istek bulunamadı.")

        await session.delete(target_membership)

        logger.info(
            "group.request_rejected",
            group_id=group_id,
            rejected_user=target_user_id,
            by_leader=requester_id
        )

        return sanic_json({"message": "Katılma isteği reddedildi."}, status=200)


# =============================================================================
# ENDPOINT 10: POST /api/groups/<group_id>/invite/<target_user_id> — Kullanıcı Davet Et
# =============================================================================

@groups_bp.post("/<group_id:int>/invite/<target_user_id:int>")
@protected
async def invite_user(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Gruba kullanıcı davet etme.
    Herhangi bir onaylı üye davet gönderebilir.
    Hedef kullanıcı GroupMember tablosuna is_approved=False (davet beklemede) olarak eklenir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    if requester_id == target_user_id:
        raise BadRequest("Kendinizi davet edemezsiniz.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        
        # İstek atan onaylı üye mi?
        requester_membership = await _get_membership(session, group_id, requester_id)
        if not requester_membership or not requester_membership.is_approved:
            raise Forbidden("Davet gönderebilmek için grubun onaylı bir üyesi olmalısınız.")

        # Hedef kullanıcı aktif ve var mı?
        stmt_user = select(User).where(User.id == target_user_id, User.is_active.is_(True), User.deleted_at.is_(None))
        target_user = await session.scalar(stmt_user)
        if not target_user:
            raise NotFound("Davet edilecek aktif kullanıcı bulunamadı.")

        # Hedef kullanıcı zaten üye veya beklemede mi?
        target_membership = await _get_membership(session, group_id, target_user_id)
        if target_membership:
            if target_membership.is_approved:
                raise BadRequest("Bu kullanıcı zaten grubun onaylı üyesi.")
            else:
                raise BadRequest("Bu kullanıcı için zaten bekleyen bir üyelik/istek/davet var.")

        is_leader = requester_membership.role == GroupMemberRole.GROUP_LEADER
        
        new_membership = GroupMember(
            user_id=target_user_id,
            group_id=group_id,
            role=GroupMemberRole.USER,
            is_approved=is_leader  # Lider davet ederse direkt onaylı başlar
        )
        session.add(new_membership)

        logger.info(
            "group.user_invited",
            group_id=group_id,
            invited_user=target_user_id,
            by_user=requester_id
        )

        return sanic_json(
            {
                "message": "Kullanıcı başarıyla gruba davet edildi (Onay bekleniyor).",
                "membership": _build_member_response(new_membership)
            },
            status=201
        )


# =============================================================================
# ENDPOINT 11: POST /api/groups/<group_id>/ban/<target_user_id> — Banla
# =============================================================================

@groups_bp.post("/<group_id:int>/ban/<target_user_id:int>")
@protected
async def ban_user(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Kullanıcıyı gruptan atar (varsa üyeliğini siler) ve GroupBan tablosuna ekler.
    Sadece o grubun onaylı lideri yapabilir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    if requester_id == target_user_id:
        raise BadRequest("Kendinizi banlayamazsınız.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        # Zaten banlı mı?
        stmt_ban = select(GroupBan).where(
            GroupBan.group_id == group_id,
            GroupBan.user_id == target_user_id
        )
        existing_ban = await session.scalar(stmt_ban)
        if existing_ban:
            raise BadRequest("Kullanıcı zaten banlı.")

        # Üyeliği varsa sil
        target_membership = await _get_membership(session, group_id, target_user_id)
        if target_membership:
            await session.delete(target_membership)

        # Ban kaydı ekle
        new_ban = GroupBan(group_id=group_id, user_id=target_user_id)
        session.add(new_ban)

        logger.info(
            "group.user_banned",
            group_id=group_id,
            banned_user=target_user_id,
            by_leader=requester_id
        )

        return sanic_json({"message": f"Kullanıcı (id={target_user_id}) gruptan banlandı."}, status=201)


# =============================================================================
# ENDPOINT 12: DELETE /api/groups/<group_id>/ban/<target_user_id> — Ban Kaldır
# =============================================================================

@groups_bp.delete("/<group_id:int>/ban/<target_user_id:int>")
@protected
async def unban_user(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Kullanıcının banını kaldırır.
    Sadece o grubun onaylı lideri yapabilir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        stmt_ban = select(GroupBan).where(
            GroupBan.group_id == group_id,
            GroupBan.user_id == target_user_id
        )
        ban_record = await session.scalar(stmt_ban)

        if not ban_record:
            raise NotFound("Bu kullanıcı için ban kaydı bulunamadı.")

        await session.delete(ban_record)

        logger.info(
            "group.user_unbanned",
            group_id=group_id,
            unbanned_user=target_user_id,
            by_leader=requester_id
        )

        return sanic_json({"message": "Kullanıcının banı kaldırıldı."}, status=200)


# =============================================================================
# ENDPOINT 13: GET /api/groups/<group_id>/bans — Banlı Kullanıcıları Listele
# =============================================================================

@groups_bp.get("/<group_id:int>/bans")
@protected
async def list_banned_users(request: Request, group_id: int) -> HTTPResponse:
    """
    Gruptan banlanan kullanıcıları listeler.
    Sadece o grubun onaylı lideri yapabilir.
    """
    requester_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _get_leader_membership(session, group_id, requester_id)

        stmt = (
            select(GroupBan)
            .options(selectinload(GroupBan.user))
            .where(GroupBan.group_id == group_id)
            .order_by(GroupBan.banned_at.desc())
        )
        bans = list(await session.scalars(stmt))

        return sanic_json({
            "group_id": group_id,
            "count": len(bans),
            "bans": [
                {
                    "user_id": b.user_id,
                    "name": b.user.name,
                    "surname": b.user.surname,
                    "mail": b.user.mail,
                    "banned_at": b.banned_at.isoformat()
                }
                for b in bans
            ]
        }, status=200)

