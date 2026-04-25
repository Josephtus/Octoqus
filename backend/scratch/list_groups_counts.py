import asyncio
from sqlalchemy import select, func
from src.database import get_session, dispose_engine
from src.models import Group, Expense

async def check():
    async with get_session() as session:
        # List all groups and their expense counts
        stmt = select(Group)
        gs = await session.scalars(stmt)
        for g in gs:
            count = await session.scalar(select(func.count(Expense.id)).where(Expense.group_id == g.id, Expense.is_deleted == False))
            print(f"ID={g.id} NAME={g.name} COUNT={count}")

async def main():
    try:
        await check()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
