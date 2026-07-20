import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../carts/cart_screen.dart';
import '../carts/carts_api.dart';
import '../format.dart';
import 'products_api.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});
  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  String? _selectedVariantId;
  int _qty = 1;
  bool _adding = false;

  Future<void> _addToCart(String variantId) async {
    setState(() => _adding = true);
    try {
      await ref.read(cartApiProvider).add(variantId, _qty);
      ref.invalidate(cartProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('장바구니에 담았어요.'),
        action: SnackBarAction(
          label: '장바구니 보기',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CartScreen()),
          ),
        ),
      ));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      if (e.code == 'not_purchasable' || e.code == 'not_found') {
        ref.invalidate(productDetailProvider(widget.productId)); // 품절·삭제 반영 갱신
      }
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

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
                    Text('${formatWon(price as int)}원',
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
                    Row(
                      children: [
                        const Text('수량', style: TextStyle(fontWeight: FontWeight.w600)),
                        const Spacer(),
                        _qtyButton(Icons.remove, _qty > 1, () => setState(() => _qty--)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text('$_qty', style: const TextStyle(fontSize: 16)),
                        ),
                        _qtyButton(Icons.add, _qty < 999, () => setState(() => _qty++)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 8),
                    Text(p['description'] as String, style: const TextStyle(height: 1.6)),
                    const SizedBox(height: 16),
                    // 판매자 정보 (Story 6.2) — 구버전 API(seller_info 없음)·
                    // company_name 미입력 판매자(빈 6행 노출 방지)에서는 숨김
                    if (p['seller_info'] is Map &&
                        ((p['seller_info'] as Map)['company_name'] as String?)
                                ?.isNotEmpty ==
                            true) ...[
                      _sellerInfoTile((p['seller_info'] as Map).cast<String, dynamic>()),
                      const SizedBox(height: 8),
                    ],
                    const SizedBox(height: 8),
                    FilledButton(
                      // 옵션 미선택·품절·요청 중에는 비활성
                      onPressed: p['sold_out'] == true || selected == null || _adding
                          ? null
                          : () => _addToCart(selected['id'] as String),
                      child: Text(p['sold_out'] == true
                          ? '품절'
                          : selected == null
                              ? '옵션을 선택해 주세요'
                              : '장바구니 담기'),
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

  /// 판매자 정보 (통신판매중개자 고지 대응) — 기본 접힘
  Widget _sellerInfoTile(Map<String, dynamic> s) {
    Widget row(String label, String? value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 110,
                child: Text(label,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ),
              Expanded(
                child: Text(value ?? '-', style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
        );
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: 12),
      title: const Text('판매자 정보',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      children: [
        row('상호', s['company_name'] as String?),
        row('대표자', s['representative_name'] as String?),
        row('사업자등록번호', s['business_registration_number'] as String?),
        row('통신판매업신고', s['mail_order_number'] as String?),
        row('사업장 주소', s['business_address'] as String?),
        row('연락처', s['contact_phone'] as String?),
      ],
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
