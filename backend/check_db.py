import asyncio
from sqlalchemy import select
from src.database import get_session
from src.models import User

async def check_user_photo():
    async with get_session() as session:
        stmt = select(User)
        users = await session.scalars(stmt)
        for user in users:
            print(f"User: {user.name}, Photo: {user.profile_photo}")

if __name__ == "__main__":
    asyncio.run(check_user_photo())
