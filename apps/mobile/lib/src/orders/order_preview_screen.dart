import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../carts/carts_api.dart';
import '../format.dart';
import 'orders_api.dart';

class OrderPreviewScreen extends ConsumerStatefulWidget {
  const OrderPreviewScreen({super.key});

  @override
  ConsumerState<OrderPreviewScreen> createState() => _OrderPreviewScreenState();
}

class _OrderPreviewScreenState extends ConsumerState<OrderPreviewScreen> {
  final _postalController = TextEditingController();
  Map<String, dynamic>? _preview; // 서버 응답 그대로 보관 — 클라이언트 재계산 금지 (AD-12)
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _postalController.dispose();
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

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    return Scaffold(
      appBar: AppBar(title: const Text('주문서')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _postalField(),
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
          child: FilledButton(
            onPressed: null, // 주문 생성은 4.4
            child: const Text('주문하기 (준비 중)'),
          ),
        ),
      ),
    );
  }

  Widget _postalField() {
    return Row(
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
            decoration: const InputDecoration(
              labelText: '우편번호',
              hintText: '5자리 숫자',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) {
              setState(() {}); // 조회 버튼 활성 상태 갱신
              if (v.length == 5) _fetchPreview(); // 5자리 완성 즉시 조회
            },
          ),
        ),
        const SizedBox(width: 12),
        OutlinedButton(
          onPressed: _postalController.text.length == 5 && !_loading ? _fetchPreview : null,
          child: const Text('배송비 조회'),
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
