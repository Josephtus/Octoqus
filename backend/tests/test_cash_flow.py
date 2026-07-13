import pytest
from decimal import Decimal
from src.services.cash_flow import _process_cash_flow_logic, _d
from src.models import Expense, SettlementStatus

# Mock Expense nesnesi oluşturmak için yardımcı sınıf
class MockExpense:
    def __init__(self, added_by, amount, is_settlement=False, recipient_id=None, settlement_status=None):
        self.added_by = added_by
        self.amount = amount
        self.is_settlement = is_settlement
        self.recipient_id = recipient_id
        self.settlement_status = settlement_status

def test_simple_two_person_split():
    """İki kişilik grupta bir kişi öderse borç doğru hesaplanmalı."""
    member_ids = [1, 2]
    user_names = {1: "User A", 2: "User B"}
    
    # User A 100 TL ödedi
    expenses = [MockExpense(added_by=1, amount=100.0)]
    
    result = _process_cash_flow_logic(member_ids, expenses, user_names)
    
    # Toplam 100, kişi başı 50. User B, User A'ya 50 ödemeli.
    assert len(result) == 1
    assert result[0]["from_user_id"] == 2
    assert result[0]["to_user_id"] == 1
    assert result[0]["amount"] == 50.0

def test_complex_multi_person_split():
    """Karmaşık bir senaryoda borçlar optimize edilmeli."""
    member_ids = [1, 2, 3]
    user_names = {1: "A", 2: "B", 3: "C"}
    
    # A=60, B=30, C=0 ödedi. Toplam=90, Kişi başı=30.
    # Beklenen: C, A'ya 30 ödemeli. B nötr.
    expenses = [
        MockExpense(added_by=1, amount=60.0),
        MockExpense(added_by=2, amount=30.0)
    ]
    
    result = _process_cash_flow_logic(member_ids, expenses, user_names)
    
    assert len(result) == 1
    assert result[0]["from_user_id"] == 3
    assert result[0]["to_user_id"] == 1
    assert result[0]["amount"] == 30.0

def test_settlement_accounted_correctly():
    """Onaylanmış borç ödemeleri (settlement) borcu azaltmalı."""
    member_ids = [1, 2]
    user_names = {1: "A", 2: "B"}
    
    # 1. Senaryo: A 100 ödedi. B 50 borçlu.
    # 2. Senaryo: B 20 TL ödeme yaptı (onaylandı).
    # Sonuç: B'nin borcu 30 TL kalmalı.
    expenses = [
        MockExpense(added_by=1, amount=100.0),
        MockExpense(added_by=2, amount=20.0, is_settlement=True, recipient_id=1, settlement_status=SettlementStatus.APPROVED)
    ]
    
    result = _process_cash_flow_logic(member_ids, expenses, user_names)
    
    assert len(result) == 1
    assert result[0]["from_user_id"] == 2
    assert result[0]["to_user_id"] == 1
    assert result[0]["amount"] == 30.0

def test_rounding_precision():
    """Kuruş farkları (0.01) sistemde kaybolmamalı."""
    member_ids = [1, 2, 3] # 3 kişi
    user_names = {1: "A", 2: "B", 3: "C"}
    
    # 100 TL harcama / 3 kişi = 33.33333...
    # Toplamın kuruşu kuruşuna tutması gerekir.
    expenses = [MockExpense(added_by=1, amount=100.0)]
    
    result = _process_cash_flow_logic(member_ids, expenses, user_names)
    
    total_repaid = sum(tx["amount"] for tx in result)
    # A=100 ödedi. Kişi başı 33.33. B borçlu 33.33, C borçlu 33.33. Toplam borç 66.66.
    assert total_repaid == 66.66
