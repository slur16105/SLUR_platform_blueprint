import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kpostal/kpostal.dart';

import '../api/client.dart';
import '../carts/carts_api.dart';
import '../config/company.dart';
import '../format.dart';
import 'order_complete_screen.dart';
import 'orders_api.dart';

class OrderPreviewScreen extends ConsumerStatefulWidget {
  const OrderPreviewScreen({super.key});

  @override
  ConsumerState<OrderPreviewScreen> createState() => _OrderPreviewScreenState();
}

class _OrderPreviewScreenState extends ConsumerState<OrderPreviewScreen> {
  final _postalController = TextEditingController();
  final _address1Controller = TextEditingController();
  final _address2Controller = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _noteController = TextEditingController();
  Map<String, dynamic>? _preview; // 서버 응답 그대로 보관 — 클라이언트 재계산 금지 (AD-12)
  bool _loading = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _postalController.dispose();
    _address1Controller.dispose();
    _address2Controller.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _fetchPreview() async {
    final postal = _postalController.text;
    if (postal.length != 5 || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    // 응답 도착 시점에 입력값이 바뀌었으면 결과를 버린다 (이전 우편번호 금액 표시 방지)
    bool stale() => _postalController.text != postal;
    try {
      final body = await ref.read(ordersApiProvider).preview(postal);
      if (!mounted || stale()) return;
      setState(() => _preview = body);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'empty_cart') {
        // 담긴 상품이 사라진 경우 — 장바구니 갱신 후 안내하고 복귀
        ref.invalidate(cartProvider);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        Navigator.of(context).pop();
        return;
      }
      if (stale()) return;
      setState(() {
        _preview = null;
        _error = e.message;
      });
    } catch (_) {
      // 캐스트 실패 등 예상 밖 오류도 무반응으로 끝내지 않는다
      if (!mounted || stale()) return;
      setState(() {
        _preview = null;
        _error = '오류가 발생했습니다. 다시 시도해 주세요.';
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        if (stale()) _fetchPreview(); // 입력이 바뀌었으면 현재 값으로 재조회 (5자리 아니면 내부에서 무시)
      }
    }
  }

  /// 우편번호 검색 (kpostal) — 선택 결과로 우편번호·기본주소를 채우고 미리보기 재조회
  Future<void> _searchPostal() async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => KpostalView(
        title: '우편번호 검색',
        callback: (Kpostal result) {
          if (!mounted) return;
          setState(() {
            _postalController.text = result.postCode;
            _address1Controller.text = result.address;
          });
          _fetchPreview(); // 프로그래밍 방식 입력은 onChanged가 안 불리므로 직접 조회
        },
      ),
    ));
  }

  // 필수 필드: 우편번호 5자리·기본주소·수령인·연락처(숫자 9~11자)
  bool get _fieldsValid =>
      _postalController.text.length == 5 &&
      _address1Controller.text.trim().isNotEmpty &&
      _nameController.text.trim().isNotEmpty &&
      RegExp(r'^\d{9,11}$').hasMatch(_phoneController.text);

  Future<void> _submitOrder() async {
    final preview = _preview;
    if (preview == null || _submitting) return;
    // 미리보기에 담긴 장바구니 항목 전부를 주문 대상으로 전송
    final cartItemIds = [
      for (final group in (preview['seller_groups'] as List).cast<Map<String, dynamic>>())
        for (final item in (group['items'] as List).cast<Map<String, dynamic>>())
          item['cart_item_id'] as String,
    ];
    setState(() => _submitting = true);
    try {
      final result = await ref.read(ordersApiProvider).createOrder(
            cartItemIds: cartItemIds,
            postalCode: _postalController.text,
            recipientName: _nameController.text.trim(),
            recipientPhone: _phoneController.text,
            address1: _address1Controller.text.trim(),
            address2: _address2Controller.text.trim(),
            orderNote: _noteController.text.trim(),
            // 미리보기 grand_total 그대로 전송 — 가격 변동 시 서버가 409 price_changed로 거부 (AD-12)
            expectedGrandTotal: preview['grand_total'] as int,
          );
      if (!mounted) return;
      ref.invalidate(cartProvider); // 주문된 항목이 장바구니에서 빠졌으므로 갱신
      // 뒤로가기로 주문서에 재진입하지 못하도록 교체 (완료 화면에서 홈까지 popUntil)
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => OrderCompleteScreen(result: result)),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'out_of_stock') {
        await _showOutOfStockDialog(e);
        return;
      }
      if (e.code == 'price_changed') {
        // 판매자가 가격·배송비를 변경한 경우 — 안내 후 미리보기 재조회로 새 금액 표시
        await _showPriceChangedDialog();
        return;
      }
      if (e.code == 'not_found' || e.code == 'duplicate_request') {
        // 다른 기기에서 장바구니 변경 / 이중 제출(이미 주문됨) — 장바구니 갱신 후 복귀
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        ref.invalidate(cartProvider);
        Navigator.of(context).pop();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('오류가 발생했습니다. 다시 시도해 주세요.')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// 금액 변경 안내 — 확인 시 미리보기 재조회로 주문서 금액 갱신
  Future<void> _showPriceChangedDialog() async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('금액 변경 안내'),
        content: const Text('주문 금액이 변경되었습니다. 다시 확인해 주세요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    _fetchPreview(); // 새 금액으로 주문서 갱신
  }

  /// 품절 안내 — details의 상품명을 보여주고 확인 시 장바구니로 복귀
  Future<void> _showOutOfStockDialog(ApiException e) async {
    final names = [
      for (final d in e.details)
        if (d is Map && d['product_name'] is String) d['product_name'] as String,
    ];
    final body = names.isEmpty ? e.message : '품절된 상품이 있습니다: ${names.join(', ')}';
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('품절 안내'),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    ref.invalidate(cartProvider); // 품절 반영된 장바구니로 갱신
    Navigator.of(context).pop(); // 장바구니 복귀
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final canSubmit = preview != null && !_loading && !_submitting && _fieldsValid;
    return Scaffold(
      appBar: AppBar(title: const Text('주문서')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _shippingSection(),
          if (_loading) ...[
            const SizedBox(height: 48),
            const Center(child: CircularProgressIndicator()),
          ] else if (_error != null) ...[
            const SizedBox(height: 48),
            Center(child: Text(_error!)),
          ] else if (preview != null) ...[
            const SizedBox(height: 16),
            for (final group
                in (preview['seller_groups'] as List).cast<Map<String, dynamic>>()) ...[
              _sellerGroupCard(group),
              const SizedBox(height: 12),
            ],
            if ((preview['remote_extra_total'] as int) > 0)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('제주/도서산간 지역으로 추가 배송비가 포함되었습니다',
                    style: TextStyle(fontSize: 12, color: Colors.orange.shade800)),
              ),
            _summary(preview),
          ] else ...[
            const SizedBox(height: 48),
            Center(
              child: Text('우편번호를 입력하면 배송비가 계산됩니다.',
                  style: TextStyle(color: Colors.grey.shade600)),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 통신판매중개자 고지 (Story 6.2)
              Container(
                padding: const EdgeInsets.all(8),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  Company.brokerNotice,
                  style: TextStyle(
                      fontSize: 11, height: 1.4, color: Colors.grey.shade600),
                ),
              ),
              FilledButton(
                onPressed: canSubmit ? _submitOrder : null,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('주문하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 배송지 입력 섹션 — 우편번호(검색/직접 입력)·주소·수령인·연락처·요청사항
  Widget _shippingSection() {
    InputDecoration deco(String label, {String? hint}) => InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('배송지', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: TextField(
                controller: _postalController,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(5),
                ],
                decoration: deco('우편번호', hint: '5자리 숫자'),
                onChanged: (v) {
                  setState(() {}); // 버튼 활성 상태 갱신
                  if (v.length == 5) _fetchPreview(); // 5자리 완성 즉시 조회
                },
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton(
              onPressed: _submitting ? null : _searchPostal,
              child: const Text('우편번호 검색'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _address1Controller,
          decoration: deco('주소', hint: '우편번호 검색 시 자동 입력'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _address2Controller,
          decoration: deco('상세 주소', hint: '동/호수 등 (선택)'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _nameController,
          decoration: deco('수령인'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(11),
          ],
          decoration: deco('연락처', hint: '숫자만 입력 (예: 01012345678)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _noteController,
          decoration: deco('배송 요청사항 (선택)', hint: '예: 문 앞에 놓아주세요'),
        ),
      ],
    );
  }

  Widget _sellerGroupCard(Map<String, dynamic> group) {
    final items = (group['items'] as List).cast<Map<String, dynamic>>();
    // 묶음 배송비도 서버 계산 값 그대로 (AD-12) — shipping_total = shipping_fee + remote_extra_fee
    final groupShipping = group['shipping_total'] as int;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(group['brand_name'] as String,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const Divider(height: 16),
            for (final item in items) _itemRow(item),
            const Divider(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('묶음 배송비', style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                Text(groupShipping == 0 ? '무료' : '${formatWon(groupShipping)}원',
                    style: const TextStyle(fontSize: 13)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> item) {
    final optionText = item['option_text'] as String;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['product_name'] as String,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                if (optionText.isNotEmpty)
                  Text(optionText,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                Text('수량 ${item['quantity']}개',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text('${formatWon(item['line_total'] as int)}원',
              style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _summary(Map<String, dynamic> preview) {
    // 요약 금액 전부 서버 계산 값 (AD-12)
    Widget row(String label, int value, {bool bold = false}) {
      final style = TextStyle(
        fontSize: bold ? 17 : 14,
        fontWeight: bold ? FontWeight.bold : FontWeight.normal,
      );
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text(label, style: style), Text('${formatWon(value)}원', style: style)],
        ),
      );
    }

    // 도서산간 추가비도 서버 계산 값 (grand_total = item_total + shipping_total + remote_extra_total)
    final remoteExtraTotal = preview['remote_extra_total'] as int;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row('상품 합계', preview['item_total'] as int),
        row('배송비', preview['shipping_total'] as int),
        if (remoteExtraTotal > 0) row('도서산간 추가비', remoteExtraTotal),
        const Divider(height: 20),
        row('총 결제 금액', preview['grand_total'] as int, bold: true),
      ],
    );
  }
}
