import asyncio
from sqlalchemy import select, func
from src.database import get_session, dispose_engine
from src.models import Group, Expense

async def check():
    async with get_session() as session:
        # Find group by name
        g = await session.scalar(select(Group).where(Group.name.like('%ESK%')))
        if not g:
            print("GROUP_NOT_FOUND")
            return
        print(f"GROUP_ID={g.id} NAME={g.name}")
        
        # Count expenses in this group
        count = await session.scalar(select(func.count(Expense.id)).where(Expense.group_id == g.id, Expense.is_deleted == False))
        print(f"EXPENSE_COUNT_IN_DB={count}")
        
        # List them
        expenses = await session.scalars(select(Expense).where(Expense.group_id == g.id, Expense.is_deleted == False))
        for e in expenses:
            print(f"EXPENSE_ID={e.id} ADDED_BY={e.added_by} AMOUNT={e.amount}")

async def main():
    try:
        await check()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
