"""캡처용 데모 데이터 — 화면이 비어 보이지 않게 실제 흐름으로 채운다.

만드는 것:
  · 상품 상세용 — 판매중 + 상세 설명이 충실한 상품
  · 장바구니 — 서로 다른 판매자 상품 3건(판매자별 묶음이 보이게)
  · 주문 2건 — ① 입금대기(입금 안내 화면) ② 배송완료(송장·반품 신청 화면)
  · 반품 1건 — 접수 상태
"""

import json
import subprocess
import sys

BASE = "http://localhost:3000"
HEAD = ["-H", "Content-Type: application/json", "-H", f"Origin: {BASE}"]

RICH_DESC = """오래 쓸수록 손에 익는 형태를 목표로 만들었습니다.

■ 소재
원목(오크) 무垢材, 천연 오일 마감. 화학 도료를 쓰지 않아 결이 그대로 드러납니다.

■ 크기
가로 240 × 세로 180 × 높이 22 (mm) · 무게 약 480g

■ 사용과 관리
· 첫 사용 전 마른 천으로 한 번 닦아주세요.
· 물에 오래 담그지 마시고, 사용 후에는 세워서 말려주세요.
· 3~6개월에 한 번 식용 오일을 얇게 발라주면 색이 오래갑니다.

■ 배송 안내
주문 확인 후 2~3일 내 출고됩니다. 제작 특성상 나뭇결과 색은 개체마다 조금씩 다릅니다."""


def curl(args, cookie=None, save=None):
    cmd = ["curl", "-s"]
    if cookie:
        cmd += ["-b", cookie]
    if save:
        cmd += ["-c", save]
    cmd += args
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except Exception:
        return {"_raw": out}


def login(email, password, jar):
    curl(["-X", "POST", f"{BASE}/api/auth/login", *HEAD,
          "-d", json.dumps({"email": email, "password": password})], save=jar)


def main():
    admin, seller, buyer = "/tmp/d_admin.txt", "/tmp/d_seller.txt", "/tmp/d_buyer.txt"
    login("local-admin@example.com", "local-admin-password-2026", admin)
    login("local-seller@example.com", "local-seller-password-2026", seller)
    login("local-buyer@example.com", "local-buyer-password-2026", buyer)

    # ── 1) 상품 상세용 상품 고르기: 판매중 + 재고 있음
    products = curl([f"{BASE}/api/products"]).get("items", [])
    target = None
    for p in products:
        detail = curl([f"{BASE}/api/products/{p['id']}"])
        vs = [v for v in detail.get("variants", []) if v.get("purchasable")]
        if vs and not detail.get("sold_out"):
            target = (p["id"], vs[0]["id"], p["name"])
            break
    if not target:
        print("판매 가능한 상품이 없습니다.", file=sys.stderr)
        return 1
    pid, vid, pname = target

    # 상세 설명 채우기 — 판매자 소유 상품만 수정 가능하므로 내 상품 중에서 다시 고른다
    mine = curl([f"{BASE}/api/sellers/products"], cookie=seller)
    if isinstance(mine, list):
        for p in mine:
            active_v = [v for v in p.get("variants", []) if v.get("stock", 0) > 0 and v.get("is_active", True)]
            if p.get("status") == "active" and active_v:
                curl(["-X", "POST", f"{BASE}/api/sellers/products", *HEAD,
                      "-d", json.dumps({"op": "patch", "id": p["id"], "description": RICH_DESC})], cookie=seller)
                pid, vid, pname = p["id"], active_v[0]["id"], p["name"]
                break
    print(f"상품 상세용: {pname}")
    open("/tmp/demo_product.txt", "w").write(pid)

    # ── 2) 장바구니 — 서로 다른 판매자 3건
    cart = curl([f"{BASE}/api/carts"], cookie=buyer)
    for item in cart.get("items", []):
        curl(["-X", "DELETE", f"{BASE}/api/carts/items/{item['id']}", *HEAD], cookie=buyer)

    picked, sellers_seen = [], set()
    for p in products:
        detail = curl([f"{BASE}/api/products/{p['id']}"])
        brand = detail.get("brand_name") or p.get("brand_name")
        vs = [v for v in detail.get("variants", []) if v.get("purchasable")]
        if not vs or brand in sellers_seen:
            continue
        sellers_seen.add(brand)
        picked.append(vs[0]["id"])
        if len(picked) == 3:
            break
    for i, v in enumerate(picked):
        curl(["-X", "POST", f"{BASE}/api/carts/items", *HEAD,
              "-d", json.dumps({"variant_id": v, "quantity": 1 + (i % 2)})], cookie=buyer)
    print(f"장바구니: {len(picked)}건 (판매자 {len(sellers_seen)}곳)")

    # ── 3) 주문 ① 입금대기 — 장바구니 일부로 주문하고, 나머지는 장바구니/주문서 화면용으로 남긴다
    quote = curl(["-X", "POST", f"{BASE}/api/orders/preview", *HEAD,
                  "-d", json.dumps({"postal_code": "06236"})], cookie=buyer)
    cart = curl([f"{BASE}/api/carts"], cookie=buyer)
    ids = [i["id"] for i in cart.get("items", []) if i.get("purchasable")]
    if ids and quote.get("grand_total"):
        order = curl(["-X", "POST", f"{BASE}/api/orders", *HEAD, "-d", json.dumps({
            "cart_item_ids": ids, "expected_grand_total": quote["grand_total"],
            "recipient_name": "로컬 구매자", "recipient_phone": "01012345678",
            "postal_code": "06236", "address1": "서울특별시 강남구 테헤란로 1",
            "address2": "101호", "order_note": "부재 시 문 앞에 놓아주세요.",
        })], cookie=buyer)
        print(f"입금대기 주문: {order.get('order_id', '실패')}")

    # 장바구니·주문서 화면용으로 다시 채운다(주문하면 비워지므로)
    for i, v in enumerate(picked):
        curl(["-X", "POST", f"{BASE}/api/carts/items", *HEAD,
              "-d", json.dumps({"variant_id": v, "quantity": 1 + (i % 2)})], cookie=buyer)

    # ── 4) 주문 ② 배송완료 + 반품 접수 — 구매자 화면에 실제 이력이 보이게
    quote = curl(["-X", "POST", f"{BASE}/api/orders/preview", *HEAD,
                  "-d", json.dumps({"postal_code": "06236"})], cookie=buyer)
    cart = curl([f"{BASE}/api/carts"], cookie=buyer)
    ids = [i["id"] for i in cart.get("items", []) if i.get("purchasable")]
    if not ids:
        print("두 번째 주문용 장바구니가 비었습니다.", file=sys.stderr)
        return 0
    order2 = curl(["-X", "POST", f"{BASE}/api/orders", *HEAD, "-d", json.dumps({
        "cart_item_ids": ids, "expected_grand_total": quote["grand_total"],
        "recipient_name": "로컬 구매자", "recipient_phone": "01012345678",
        "postal_code": "06236", "address1": "서울특별시 강남구 테헤란로 1",
        "address2": "101호", "order_note": "",
    })], cookie=buyer)
    oid2 = order2.get("order_id")
    curl(["-X", "POST", f"{BASE}/api/admin/deposits", *HEAD,
          "-d", json.dumps({"order_id": oid2, "expected_grand_total": quote["grand_total"]})], cookie=admin)

    detail = curl([f"{BASE}/api/orders/{oid2}"], cookie=buyer)
    for sub in detail.get("sub_orders", []):
        sid = sub["sub_order_id"]
        curl(["-X", "POST", f"{BASE}/api/seller/orders", *HEAD, "-d", json.dumps({
            "action": "ship", "sub_order_id": sid,
            "carrier": "CJ대한통운", "tracking_number": "641234567890",
        })], cookie=seller)
        curl(["-X", "POST", f"{BASE}/api/seller/orders", *HEAD,
              "-d", json.dumps({"action": "deliver", "sub_order_id": sid})], cookie=seller)

    detail = curl([f"{BASE}/api/orders/{oid2}"], cookie=buyer)
    sub = detail["sub_orders"][0]
    item = sub["items"][0]
    ret = curl(["-X", "POST", f"{BASE}/api/returns", *HEAD, "-d", json.dumps({
        "sub_order_id": sub["sub_order_id"], "kind": "return", "reason": "defect",
        "detail": "모서리에 찍힘이 있어 교환 대신 반품을 신청합니다.",
        "items": [{"order_item_id": item["order_item_id"], "quantity": 1}],
    })], cookie=buyer)
    print(f"배송완료 주문: {oid2} · 반품 접수: {ret.get('id', '실패')}")

    # 장바구니 다시 채우기 — 장바구니·주문서 캡처용
    for i, v in enumerate(picked):
        curl(["-X", "POST", f"{BASE}/api/carts/items", *HEAD,
              "-d", json.dumps({"variant_id": v, "quantity": 1 + (i % 2)})], cookie=buyer)
    cart = curl([f"{BASE}/api/carts"], cookie=buyer)
    print(f"최종 장바구니: {len(cart.get('items', []))}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
