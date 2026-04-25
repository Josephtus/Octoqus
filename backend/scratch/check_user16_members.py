import asyncio
from sqlalchemy import select
from src.database import get_session, dispose_engine
from src.models import User, GroupMember

async def check():
    async with get_session() as session:
        user = await session.scalar(select(User).where(User.mail == 'user16@example.com'))
        if not user:
            print("USER_NOT_FOUND")
            return
        
        # Check all memberships
        stmt = select(GroupMember).where(GroupMember.user_id == user.id)
        members = await session.scalars(stmt)
        for m in members:
            print(f"GROUP_ID={m.group_id} APPROVED={m.is_approved} ROLE={m.role}")

async def main():
    try:
        await check()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
