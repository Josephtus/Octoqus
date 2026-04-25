import asyncio
from sqlalchemy import select
from src.database import get_session, dispose_engine
from src.models import User, Expense

async def check():
    async with get_session() as session:
        user = await session.scalar(select(User).where(User.mail == 'user16@example.com'))
        if not user:
            print("USER_NOT_FOUND")
            return
        print(f"USER_ID={user.id}")
        
        expenses = await session.scalars(select(Expense).where(Expense.added_by == user.id))
        count = 0
        for e in expenses:
            print(f"EXPENSE_ID={e.id} GROUP_ID={e.group_id}")
            count += 1
        print(f"TOTAL_USER_EXPENSES={count}")

async def main():
    try:
        await check()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
