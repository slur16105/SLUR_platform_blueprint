import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../carts/cart_screen.dart';
import '../format.dart';
import '../orders/order_history_screen.dart';
import '../products/product_detail_screen.dart';
import '../products/products_api.dart';
import 'service_info_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key, required this.user});
  final Map<String, dynamic> user;

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String? _categoryId; // null = 전체

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);
    final products = ref.watch(productListProvider(_categoryId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('SLUR', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ServiceInfoScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const OrderHistoryScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CartScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(currentUserProvider.notifier).logout(),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: categories.when(
              loading: () => const SizedBox.shrink(),
              error: (_, s) => const SizedBox.shrink(),
              data: (cats) => ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _tab('전체', null),
                  for (final c in cats) _tab(c['name'] as String, c['id'] as String),
                ],
              ),
            ),
          ),
          Expanded(
            child: products.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, s) => const Center(child: Text('상품을 불러오지 못했습니다.')),
              data: (body) {
                final items = (body['items'] as List).cast<Map<String, dynamic>>();
                if (items.isEmpty) {
                  return const Center(child: Text('아직 등록된 상품이 없어요.'));
                }
                return RefreshIndicator(
                  // Future를 그대로 반환 — RefreshIndicator가 await하므로 스피너가 조기 dismiss되지 않는다
                  // (`() async => ...`는 refresh 결과를 버려 unused_result 경고도 난다)
                  onRefresh: () => ref.refresh(productListProvider(_categoryId).future),
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                    itemCount: items.length,
                    itemBuilder: (context, i) => _card(items[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _tab(String label, String? id) {
    final selected = _categoryId == id;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _categoryId = id),
      ),
    );
  }

  Widget _card(Map<String, dynamic> p) {
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProductDetailScreen(productId: p['id'] as String)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: p['main_image_url'] != null
                      ? Image.network(p['main_image_url'] as String, fit: BoxFit.cover)
                      : Container(color: Colors.grey.shade200),
                ),
                if (p['sold_out'] == true)
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8), color: Colors.black38),
                    alignment: Alignment.center,
                    child: const Text('품절', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(p['brand_name'] as String, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          Text(p['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('${formatWon(p['price_from'] as int)}원', style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
