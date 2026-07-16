import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'products_api.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});
  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _selectedVariantId;

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(productDetailProvider(widget.productId));
    return Scaffold(
      appBar: AppBar(),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, s) => const Center(child: Text('상품을 불러오지 못했습니다.')),
        data: (p) {
          final variants = (p['variants'] as List).cast<Map<String, dynamic>>();
          final hasOptions = variants.any((v) => (v['option1_value'] as String).isNotEmpty);
          final selected = variants.where((v) => v['id'] == _selectedVariantId).firstOrNull ??
              (hasOptions ? null : variants.firstOrNull);
          // 가격은 백엔드 계산 값만 표시 (AD-12)
          final price = selected?['final_price'] ?? p['price_from'];
          final images = (p['image_urls'] as List).cast<String>();

          return ListView(
            children: [
              if (images.isNotEmpty)
                SizedBox(
                  height: 320,
                  child: PageView(
                    children: [for (final url in images) Image.network(url, fit: BoxFit.cover)],
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p['brand_name'] as String,
                        style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                    const SizedBox(height: 4),
                    Text(p['name'] as String,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Text('${_won(price as int)}원',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    if (hasOptions) ...[
                      Text(_optionLabel(variants), style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final v in variants)
                            ChoiceChip(
                              label: Text('${_variantLabel(v)}${v['purchasable'] == true ? '' : ' (품절)'}'),
                              selected: _selectedVariantId == v['id'],
                              onSelected: v['purchasable'] == true
                                  ? (sel) => setState(() => _selectedVariantId = sel ? v['id'] as String : null)
                                  : null, // 품절 조합 선택 불가 (표기는 유지)
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                    const Divider(),
                    const SizedBox(height: 8),
                    Text(p['description'] as String, style: const TextStyle(height: 1.6)),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: null, // 장바구니는 Epic 4
                      child: Text(p['sold_out'] == true ? '품절' : '장바구니 (준비 중)'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _won(int v) => v.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');

  String _optionLabel(List<Map<String, dynamic>> variants) {
    final v = variants.first;
    final n1 = v['option1_name'] as String;
    final n2 = v['option2_name'] as String;
    return n2.isNotEmpty ? '$n1 / $n2' : n1;
  }

  String _variantLabel(Map<String, dynamic> v) {
    final v1 = v['option1_value'] as String;
    final v2 = v['option2_value'] as String;
    return v2.isNotEmpty ? '$v1 · $v2' : v1;
  }
}
