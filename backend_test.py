#!/usr/bin/env python3
"""
Phase 1 Backend Testing — Local NLU Chat Engine
Tests the new pattern-based NLU engine that replaced external LLM APIs.
"""

import requests
import json
import random
import time
from typing import Dict, List, Any

# Configuration
BASE_URL = "http://localhost:3000/api"
DEMO_RESTAURANT_ID = "rest_demo_1"
DEMO_TABLE_ID = "table_demo_1"

# Demo menu items
DEMO_MENU = [
    {
        "id": "menu_demo_1",
        "name": "Truffle Pasta",
        "description": "Hand-rolled tagliatelle in white truffle cream",
        "price": 18.50,
        "category": "Mains"
    },
    {
        "id": "menu_demo_2",
        "name": "Margherita Pizza",
        "description": "Wood-fired with San Marzano tomatoes",
        "price": 14.00,
        "category": "Mains"
    },
    {
        "id": "menu_demo_3",
        "name": "Chocolate Lava Cake",
        "description": "Warm chocolate center with vanilla cream",
        "price": 9.00,
        "category": "Desserts"
    }
]

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "errors": []
}

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {details}")

def chat_request(session_id: str, message: str, cart: List[Dict] = None, 
                 allergy: str = "", spicy: str = "", notes: str = "", 
                 stage: str = "browsing") -> Dict[str, Any]:
    """Send a chat request"""
    payload = {
        "sessionId": session_id,
        "restaurantId": DEMO_RESTAURANT_ID,
        "tableId": DEMO_TABLE_ID,
        "message": message,
        "menu": DEMO_MENU,
        "cart": cart or [],
        "allergy": allergy,
        "spicy": spicy,
        "notes": notes,
        "stage": stage
    }
    
    try:
        response = requests.post(f"{BASE_URL}/chat", json=payload, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        return {"error": str(e)}

def test_multi_turn_conversation():
    """Test the complete multi-turn conversation flow"""
    print("\n" + "="*80)
    print("TESTING: Multi-turn Conversation Flow")
    print("="*80)
    
    session_id = f"phase1_test_{random.randint(1000, 9999)}"
    cart = []
    allergy = ""
    spicy = ""
    notes = ""
    
    # Turn 1: Greeting
    print("\n--- Turn 1: Greeting ---")
    result = chat_request(session_id, "hi")
    if "error" in result:
        log_test("Turn 1 - Greeting", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_greeting = any(word in reply for word in ["hi", "hello", "welcome"])
    no_add_items = "add_items" not in actions
    
    log_test("Turn 1 - Greeting response", has_greeting, f"Reply: {result.get('reply', '')[:100]}")
    log_test("Turn 1 - No add_items action", no_add_items, f"Actions: {actions}")
    
    # Turn 2: Menu request
    print("\n--- Turn 2: Menu Request ---")
    result = chat_request(session_id, "show me the menu")
    if "error" in result:
        log_test("Turn 2 - Menu request", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_show_menu = actions.get("show_menu") == True
    mentions_menu = "menu" in reply or "item" in reply
    
    log_test("Turn 2 - show_menu action", has_show_menu, f"Actions: {actions}")
    log_test("Turn 2 - Menu mentioned in reply", mentions_menu, f"Reply: {result.get('reply', '')[:100]}")
    
    # Turn 3: Recommendation
    print("\n--- Turn 3: Recommendation ---")
    result = chat_request(session_id, "recommend something")
    if "error" in result:
        log_test("Turn 3 - Recommendation", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    has_menu_item = any(item["name"].lower() in reply for item in DEMO_MENU)
    
    log_test("Turn 3 - Recommendation contains menu item", has_menu_item, f"Reply: {result.get('reply', '')[:150]}")
    
    # Turn 4: Add items (fuzzy + qty)
    print("\n--- Turn 4: Add Items ---")
    result = chat_request(session_id, "add 2 truffle pasta")
    if "error" in result:
        log_test("Turn 4 - Add items", False, result["error"])
        return
    
    actions = result.get("actions", {})
    add_items = actions.get("add_items", [])
    
    has_add_items = len(add_items) > 0
    correct_item = False
    correct_qty = False
    
    if has_add_items:
        item = add_items[0]
        correct_item = item.get("id") == "menu_demo_1"
        correct_qty = item.get("quantity") == 2
        # Update cart for next turns
        cart = [{"id": "menu_demo_1", "name": "Truffle Pasta", "price": 18.50, "qty": 2}]
    
    log_test("Turn 4 - add_items action present", has_add_items, f"Actions: {actions}")
    log_test("Turn 4 - Correct item (menu_demo_1)", correct_item, f"Item: {add_items[0] if add_items else 'None'}")
    log_test("Turn 4 - Correct quantity (2)", correct_qty, f"Quantity: {add_items[0].get('quantity') if add_items else 'None'}")
    
    # Turn 5: Place order with cart (should ask about allergies)
    print("\n--- Turn 5: Place Order (Initial) ---")
    result = chat_request(session_id, "place order", cart=cart)
    if "error" in result:
        log_test("Turn 5 - Place order initial", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    no_place_order = actions.get("place_order") != True
    asks_allergy = "allerg" in reply
    
    log_test("Turn 5 - No place_order action yet", no_place_order, f"Actions: {actions}")
    log_test("Turn 5 - Asks about allergies", asks_allergy, f"Reply: {result.get('reply', '')[:100]}")
    
    # Turn 6: Answer allergy
    print("\n--- Turn 6: Answer Allergy ---")
    result = chat_request(session_id, "peanuts", cart=cart, allergy="", spicy="", notes="")
    if "error" in result:
        log_test("Turn 6 - Answer allergy", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_set_allergy = "set_allergy" in actions
    allergy_value = actions.get("set_allergy", "")
    asks_spice = "spic" in reply or "hot" in reply or "mild" in reply
    
    if has_set_allergy:
        allergy = allergy_value
    
    log_test("Turn 6 - set_allergy action", has_set_allergy, f"Actions: {actions}")
    log_test("Turn 6 - Allergy contains 'peanuts'", "peanut" in allergy_value.lower(), f"Allergy: {allergy_value}")
    log_test("Turn 6 - Asks about spice", asks_spice, f"Reply: {result.get('reply', '')[:100]}")
    
    # Turn 7: Answer spice
    print("\n--- Turn 7: Answer Spice ---")
    result = chat_request(session_id, "medium", cart=cart, allergy=allergy, spicy="", notes="")
    if "error" in result:
        log_test("Turn 7 - Answer spice", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_set_spicy = "set_spicy" in actions
    spicy_value = actions.get("set_spicy", "")
    asks_notes = "note" in reply or "chef" in reply or "extra" in reply
    
    if has_set_spicy:
        spicy = spicy_value
    
    log_test("Turn 7 - set_spicy action", has_set_spicy, f"Actions: {actions}")
    log_test("Turn 7 - Spicy is 'medium'", spicy_value == "medium", f"Spicy: {spicy_value}")
    log_test("Turn 7 - Asks for notes", asks_notes, f"Reply: {result.get('reply', '')[:100]}")
    
    # Turn 8: Answer notes
    print("\n--- Turn 8: Answer Notes ---")
    result = chat_request(session_id, "extra cheese", cart=cart, allergy=allergy, spicy=spicy, notes="")
    if "error" in result:
        log_test("Turn 8 - Answer notes", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_set_notes = "set_notes" in actions
    notes_value = actions.get("set_notes", "")
    shows_summary = "summary" in reply or "final" in reply or allergy.lower() in reply
    asks_confirm = "ready" in reply or "confirm" in reply or "send" in reply or "yes" in reply
    
    if has_set_notes:
        notes = notes_value
    
    log_test("Turn 8 - set_notes action", has_set_notes, f"Actions: {actions}")
    log_test("Turn 8 - Notes contains 'extra cheese'", "cheese" in notes_value.lower(), f"Notes: {notes_value}")
    log_test("Turn 8 - Shows summary", shows_summary, f"Reply: {result.get('reply', '')[:150]}")
    log_test("Turn 8 - Asks for confirmation", asks_confirm, f"Reply: {result.get('reply', '')[:150]}")
    
    # Turn 9: Confirm
    print("\n--- Turn 9: Confirm Order ---")
    result = chat_request(session_id, "yes", cart=cart, allergy=allergy, spicy=spicy, notes=notes)
    if "error" in result:
        log_test("Turn 9 - Confirm order", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    has_place_order = actions.get("place_order") == True
    success_message = any(word in reply for word in ["sending", "kitchen", "awesome", "great"])
    
    log_test("Turn 9 - place_order action", has_place_order, f"Actions: {actions}")
    log_test("Turn 9 - Success confirmation", success_message, f"Reply: {result.get('reply', '')[:100]}")
    
    # Turn 10: Pay intent
    print("\n--- Turn 10: Pay Intent ---")
    result = chat_request(session_id, "pay", cart=cart, allergy=allergy, spicy=spicy, notes=notes)
    if "error" in result:
        log_test("Turn 10 - Pay intent", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    mentions_payment = any(word in reply for word in ["payment", "bill", "pay", "upi"])
    has_payment_action = "show_bill" in actions or "pay_now" in actions
    
    log_test("Turn 10 - Mentions payment/bill", mentions_payment, f"Reply: {result.get('reply', '')[:100]}")
    log_test("Turn 10 - Has payment action", has_payment_action, f"Actions: {actions}")

def test_spice_variants():
    """Test different spice level inputs"""
    print("\n" + "="*80)
    print("TESTING: Spice Variants")
    print("="*80)
    
    test_cases = [
        ("very spicy", "hot"),
        ("extra hot", "extra-hot"),
        ("no spice", "mild"),
        ("mild", "mild"),
        ("hot", "hot"),
    ]
    
    for message, expected in test_cases:
        session_id = f"spice_test_{random.randint(1000, 9999)}"
        
        # First, set up the conversation to ask about spice
        chat_request(session_id, "hi")
        cart = [{"id": "menu_demo_1", "name": "Truffle Pasta", "price": 18.50, "qty": 1}]
        chat_request(session_id, "place order", cart=cart)
        chat_request(session_id, "none", cart=cart, allergy="", spicy="", notes="")
        
        # Now answer with the spice level
        result = chat_request(session_id, message, cart=cart, allergy="none", spicy="", notes="")
        
        if "error" in result:
            log_test(f"Spice variant '{message}'", False, result["error"])
            continue
        
        actions = result.get("actions", {})
        spicy_value = actions.get("set_spicy", "")
        
        log_test(f"Spice variant '{message}' -> '{expected}'", spicy_value == expected, 
                f"Expected: {expected}, Got: {spicy_value}")

def test_cancel_action():
    """Test cancel/clear_last action"""
    print("\n" + "="*80)
    print("TESTING: Cancel Action")
    print("="*80)
    
    session_id = f"cancel_test_{random.randint(1000, 9999)}"
    
    # Add an item first
    chat_request(session_id, "hi")
    chat_request(session_id, "add truffle pasta")
    
    # Now cancel
    result = chat_request(session_id, "cancel that")
    
    if "error" in result:
        log_test("Cancel action", False, result["error"])
        return
    
    actions = result.get("actions", {})
    has_clear_last = actions.get("clear_last") == True
    
    log_test("Cancel action - clear_last", has_clear_last, f"Actions: {actions}")

def test_empty_cart_place_order():
    """Test placing order with empty cart"""
    print("\n" + "="*80)
    print("TESTING: Empty Cart Place Order")
    print("="*80)
    
    session_id = f"empty_cart_test_{random.randint(1000, 9999)}"
    
    chat_request(session_id, "hi")
    result = chat_request(session_id, "place order", cart=[])
    
    if "error" in result:
        log_test("Empty cart place order", False, result["error"])
        return
    
    reply = result.get("reply", "").lower()
    actions = result.get("actions", {})
    
    no_place_order = actions.get("place_order") != True
    nudges_to_add = any(word in reply for word in ["empty", "add", "menu", "items"])
    
    log_test("Empty cart - No place_order action", no_place_order, f"Actions: {actions}")
    log_test("Empty cart - Nudges to add items", nudges_to_add, f"Reply: {result.get('reply', '')[:100]}")

def test_spanish_greeting():
    """Test Spanish greeting"""
    print("\n" + "="*80)
    print("TESTING: Spanish Greeting")
    print("="*80)
    
    session_id = f"spanish_test_{random.randint(1000, 9999)}"
    
    result = chat_request(session_id, "hola")
    
    if "error" in result:
        log_test("Spanish greeting", False, result["error"])
        return
    
    reply = result.get("reply", "")
    is_friendly = len(reply) > 0 and any(word in reply.lower() for word in ["hi", "hello", "welcome", "hola"])
    
    log_test("Spanish greeting - Friendly response", is_friendly, f"Reply: {reply[:100]}")

def test_regression_auth():
    """Regression test: Authentication"""
    print("\n" + "="*80)
    print("REGRESSION TEST: Authentication")
    print("="*80)
    
    try:
        # Test central auth
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "type": "central",
            "userId": "hello",
            "password": "123456"
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            has_user = "user" in data
            log_test("Regression - Central auth", has_user, f"Response: {data}")
        else:
            log_test("Regression - Central auth", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Regression - Central auth", False, str(e))

def test_regression_restaurants():
    """Regression test: Restaurants endpoint"""
    print("\n" + "="*80)
    print("REGRESSION TEST: Restaurants")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/restaurants", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            has_restaurants = "restaurants" in data
            log_test("Regression - Get restaurants", has_restaurants, f"Found {len(data.get('restaurants', []))} restaurants")
        else:
            log_test("Regression - Get restaurants", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Regression - Get restaurants", False, str(e))

def test_regression_menu():
    """Regression test: Menu endpoint"""
    print("\n" + "="*80)
    print("REGRESSION TEST: Menu")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/menu?restaurantId={DEMO_RESTAURANT_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            has_items = "items" in data
            item_count = len(data.get("items", []))
            log_test("Regression - Get menu", has_items and item_count >= 3, 
                    f"Found {item_count} menu items")
        else:
            log_test("Regression - Get menu", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Regression - Get menu", False, str(e))

def test_regression_tables():
    """Regression test: Tables endpoint"""
    print("\n" + "="*80)
    print("REGRESSION TEST: Tables")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/tables?restaurantId={DEMO_RESTAURANT_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            has_tables = "tables" in data
            log_test("Regression - Get tables", has_tables, f"Found {len(data.get('tables', []))} tables")
        else:
            log_test("Regression - Get tables", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Regression - Get tables", False, str(e))

def test_regression_orders():
    """Regression test: Orders endpoint"""
    print("\n" + "="*80)
    print("REGRESSION TEST: Orders")
    print("="*80)
    
    try:
        # Create a test order
        order_data = {
            "restaurantId": DEMO_RESTAURANT_ID,
            "tableId": DEMO_TABLE_ID,
            "items": [
                {"id": "menu_demo_1", "name": "Truffle Pasta", "price": 18.50, "quantity": 1}
            ],
            "total": 18.50,
            "customerName": "Test Customer",
            "allergy": "none",
            "spicy": "medium",
            "notes": "Test order"
        }
        
        response = requests.post(f"{BASE_URL}/orders", json=order_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            has_order = "order" in data
            log_test("Regression - Create order", has_order, f"Order created: {data.get('order', {}).get('id', 'N/A')}")
        else:
            log_test("Regression - Create order", False, f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Regression - Create order", False, str(e))

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Passed: {test_results['passed']}")
    print(f"Total Failed: {test_results['failed']}")
    print(f"Success Rate: {test_results['passed'] / (test_results['passed'] + test_results['failed']) * 100:.1f}%")
    
    if test_results["errors"]:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for error in test_results["errors"]:
            print(f"  • {error}")
    
    print("\n" + "="*80)

def main():
    """Main test runner"""
    print("="*80)
    print("PHASE 1 BACKEND TESTING — LOCAL NLU CHAT ENGINE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Demo Restaurant: {DEMO_RESTAURANT_ID}")
    print(f"Demo Table: {DEMO_TABLE_ID}")
    print("="*80)
    
    # Wait for service to be ready
    print("\nWaiting for service to be ready...")
    time.sleep(2)
    
    try:
        # Primary tests
        test_multi_turn_conversation()
        test_spice_variants()
        test_cancel_action()
        test_empty_cart_place_order()
        test_spanish_greeting()
        
        # Regression tests
        test_regression_auth()
        test_regression_restaurants()
        test_regression_menu()
        test_regression_tables()
        test_regression_orders()
        
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user.")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
    finally:
        print_summary()

if __name__ == "__main__":
    main()
