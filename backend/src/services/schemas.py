"""
src/services/schemas.py
=======================
Paylaşılan Pydantic şemaları (Validation schemas).
"""

from pydantic import BaseModel, field_validator
from datetime import date

class BaseUserUpdateSchema(BaseModel):
    """
    Hem profil güncelleme hem de admin kullanıcı güncelleme için ortak şema.
    """
    name: str | None = None
    surname: str | None = None
    age: int | None = None
    phone_number: str | None = None
    birthday: str | None = None  # ISO format: "1995-07-20"

    @field_validator("name", "surname")
    @classmethod
    def strip_and_validate_str(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Bu alan boş string olamaz.")
        if len(v) > 100:
            raise ValueError("Bu alan en fazla 100 karakter olabilir.")
        return v

    @field_validator("age")
    @classmethod
    def validate_age(cls, v: int | None) -> int | None:
        if v is not None and (v < 13 or v > 120):
            raise ValueError("Yaş 13 ile 120 arasında olmalıdır.")
        return v

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v.startswith("+") or not v[1:].isdigit():
            raise ValueError("Telefon numarası uluslararası formatta olmalıdır. Örn: +905551234567")
        if len(v) < 10 or len(v) > 16:
            raise ValueError("Telefon numarası 10-16 karakter arasında olmalıdır.")
        return v

    @field_validator("birthday")
    @classmethod
    def validate_birthday(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("Doğum tarihi ISO formatında (YYYY-MM-DD) olmalıdır.")
        return v
