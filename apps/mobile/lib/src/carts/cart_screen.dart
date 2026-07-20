import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../format.dart';
import '../orders/order_preview_screen.dart';
import 'carts_api.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('장바구니')),
      body: cart.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, s) => const Center(child: Text('장바구니를 불러오지 못했습니다.')),
        data: (body) {
          final items = (body['items'] as List).cast<Map<String, dynamic>>();
          if (items.isEmpty) {
            return const Center(child: Text('장바구니가 비어 있어요.'));
          }
          return Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  // Future를 그대로 반환 — RefreshIndicator가 await하므로 스피너가 조기 dismiss되지 않는다
                  // (`() async => ...`는 refresh 결과를 버려 unused_result 경고도 난다)
                  onRefresh: () => ref.refresh(cartProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: items.length,
                    separatorBuilder: (_, s) => const Divider(height: 24),
                    itemBuilder: (context, i) => _CartItemTile(item: items[i]),
                  ),
                ),
              ),
              _summaryBar(context, body),
            ],
          );
        },
      ),
    );
  }

  Widget _summaryBar(BuildContext context, Map<String, dynamic> body) {
    // 합계는 서버 계산 값만 표시 (AD-12) — 구매 불가 항목 제외 금액
    final total = body['purchasable_total'] as int;
    final hasPurchasable = (body['items'] as List)
        .cast<Map<String, dynamic>>()
        .any((item) => item['purchasable'] == true);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('상품 합계', style: TextStyle(fontSize: 15)),
                Text('${formatWon(total)}원',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 4),
            Text('배송비는 주문서에서 계산됩니다.',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            FilledButton(
              // 구매 가능 항목이 있을 때만 주문서 진입 (주문 생성은 4.4)
              onPressed: hasPurchasable
                  ? () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const OrderPreviewScreen()),
                      )
                  : null,
              child: Text(hasPurchasable ? '주문하기' : '구매 가능한 상품이 없습니다'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartItemTile extends ConsumerWidget {
  const _CartItemTile({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final purchasable = item['purchasable'] == true;
    final qty = item['quantity'] as int;
    final price = item['final_price'] as int?;

    Future<void> guard(Future<void> Function() action) async {
      try {
        await action();
      } on ApiException catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
      } finally {
        ref.invalidate(cartProvider);
      }
    }

    return Opacity(
      opacity: purchasable ? 1 : 0.45, // 구매 불가는 흐리게 — 숨기지 않는다 (FR-35)
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 72,
              height: 72,
              child: item['image_url'] != null
                  ? Image.network(item['image_url'] as String, fit: BoxFit.cover)
                  : Container(color: Colors.grey.shade200),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['brand_name'] as String,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                Text(item['product_name'] as String,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                if ((item['option_text'] as String).isNotEmpty)
                  Text(item['option_text'] as String,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                const SizedBox(height: 4),
                if (!purchasable)
                  const Text('구매 불가',
                      style: TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w600))
                else if (price != null)
                  Text('${formatWon(price * qty)}원',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _qtyButton(Icons.remove, qty > 1 && purchasable,
                        () => guard(() => ref.read(cartApiProvider).updateQuantity(item['id'] as String, qty - 1))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('$qty'),
                    ),
                    _qtyButton(Icons.add, qty < 999 && purchasable,
                        () => guard(() => ref.read(cartApiProvider).updateQuantity(item['id'] as String, qty + 1))),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 20),
                      onPressed: () => guard(() => ref.read(cartApiProvider).remove(item['id'] as String)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _qtyButton(IconData icon, bool enabled, VoidCallback onTap) {
    return SizedBox(
      width: 32,
      height: 32,
      child: OutlinedButton(
        onPressed: enabled ? onTap : null,
        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
        child: Icon(icon, size: 16),
      ),
    );
  }
}
