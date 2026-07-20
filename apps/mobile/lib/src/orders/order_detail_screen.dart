import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../format.dart';
import 'order_display.dart';
import 'orders_api.dart';

/// 주문 상세 화면 — 금액·상태·cancellable 전부 서버 값 표시만 (AD-12)
class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  Map<String, dynamic>? _order; // 서버 응답 그대로 보관 — 클라이언트 재계산 금지 (AD-12)
  bool _loading = false;
  bool _canceling = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = await ref.read(ordersApiProvider).getOrder(widget.orderId);
      if (!mounted) return;
      setState(() => _order = body);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'not_found') {
        // 주문이 없는 경우 — 안내 후 목록으로 복귀
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        Navigator.of(context).pop();
        return;
      }
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// 묶음 취소 — 사유 입력(선택) 다이얼로그 후 취소 요청
  Future<void> _cancelSubOrder(Map<String, dynamic> sub) async {
    if (_canceling) return;
    final controller = TextEditingController();
    // 확인 시 사유 문자열(빈 문자열 가능), 취소/닫기 시 null
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('${sub['brand_name']} 묶음 취소'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('이 판매자 묶음의 주문을 취소할까요?'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: '취소 사유 (선택)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('닫기'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('묶음 취소'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || !mounted) return;

    setState(() => _canceling = true);
    try {
      await ref
          .read(ordersApiProvider)
          .cancelSubOrder(sub['sub_order_id'] as String, reason: reason);
      if (!mounted) return;
      await _fetch(); // 성공 → 취소 반영된 상세 재조회
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'invalid_transition') {
        // 이미 배송이 시작되는 등 취소 불가 전이 — 서버 메시지 그대로 안내 후 최신 상태 재조회
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            content: Text(e.message),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('확인'),
              ),
            ],
          ),
        );
        if (mounted) await _fetch();
        return;
      }
      if (e.code == 'not_found') {
        // 대상 묶음이 없는 경우 — 안내 후 목록 복귀
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        Navigator.of(context).pop();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('오류가 발생했습니다. 다시 시도해 주세요.')));
    } finally {
      if (mounted) setState(() => _canceling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(title: const Text('주문 상세')),
      body: order == null
          ? Center(
              child: _loading
                  ? const CircularProgressIndicator()
                  : Text(_error ?? '주문을 불러오지 못했습니다.'),
            )
          : RefreshIndicator(
              onRefresh: () async {
                await _fetch();
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  _header(order),
                  const SizedBox(height: 16),
                  _shippingCard(order),
                  const SizedBox(height: 12),
                  for (final sub in (order['sub_orders'] as List)
                      .cast<Map<String, dynamic>>()) ...[
                    _subOrderCard(sub),
                    const SizedBox(height: 12),
                  ],
                  _summary(order),
                  if (order['deposit_info'] != null) ...[
                    const SizedBox(height: 16),
                    _depositBox(order['deposit_info'] as Map<String, dynamic>),
                  ],
                ],
              ),
            ),
    );
  }

  /// 상단 — 주문번호·날짜·대표 상태
  Widget _header(Map<String, dynamic> order) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('주문번호 ${order['order_no']}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(formatOrderDate(order['created_at'] as String),
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            ],
          ),
        ),
        StatusBadge(status: order['display_status'] as String),
      ],
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(label,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }

  /// 배송지 카드 — 수령인·연락처·주소·요청사항
  Widget _shippingCard(Map<String, dynamic> order) {
    final address2 = '${order['address2'] ?? ''}';
    final orderNote = '${order['order_note'] ?? ''}';
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('배송지', style: TextStyle(fontWeight: FontWeight.bold)),
            const Divider(height: 16),
            _infoRow('수령인', '${order['recipient_name']}'),
            _infoRow('연락처', '${order['recipient_phone']}'),
            _infoRow('주소',
                '(${order['postal_code']}) ${order['address1']}${address2.isEmpty ? '' : ' $address2'}'),
            if (orderNote.isNotEmpty) _infoRow('요청사항', orderNote),
          ],
        ),
      ),
    );
  }

  /// 판매자 묶음 카드 — 브랜드·상태·송장·라인·묶음 배송비·취소 버튼
  Widget _subOrderCard(Map<String, dynamic> sub) {
    final items = (sub['items'] as List).cast<Map<String, dynamic>>();
    final carrier = sub['carrier'] as String?;
    final trackingNumber = sub['tracking_number'] as String?;
    final hasTracking = carrier != null &&
        carrier.isNotEmpty &&
        trackingNumber != null &&
        trackingNumber.isNotEmpty;
    // 배송비·도서산간 추가비 전부 서버 값 그대로 표시 (AD-12 — 합산도 하지 않는다)
    final shippingFee = sub['shipping_fee'] as int;
    final remoteExtraFee = sub['remote_extra_fee'] as int;

    Widget feeRow(String label, int value) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
          Text(value == 0 ? '무료' : '${formatWon(value)}원',
              style: const TextStyle(fontSize: 13)),
        ],
      );
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(sub['brand_name'] as String,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
                StatusBadge(status: sub['display_status'] as String),
              ],
            ),
            if (hasTracking) ...[
              const SizedBox(height: 6),
              Text('송장 $carrier $trackingNumber',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
            ],
            const Divider(height: 16),
            for (final item in items) _itemRow(item),
            const Divider(height: 16),
            feeRow('묶음 배송비', shippingFee),
            if (remoteExtraFee > 0) ...[
              const SizedBox(height: 4),
              feeRow('도서산간 추가비', remoteExtraFee),
            ],
            if (sub['cancellable'] == true) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _canceling ? null : () => _cancelSubOrder(sub),
                  child: const Text('묶음 취소'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> item) {
    final optionText = item['option_text'] as String? ?? '';
    final canceled = item['status'] == 'canceled';
    // 취소된 라인은 취소선 + 흐린 색으로 구분
    final nameStyle = TextStyle(
      decoration: canceled ? TextDecoration.lineThrough : null,
      color: canceled ? Colors.grey.shade500 : null,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(item['product_name'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: nameStyle),
                    ),
                    if (canceled) ...[
                      const SizedBox(width: 6),
                      const Text('취소',
                          style: TextStyle(
                              fontSize: 11,
                              color: Colors.red,
                              fontWeight: FontWeight.w600)),
                    ],
                  ],
                ),
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
              style: TextStyle(
                fontWeight: FontWeight.w600,
                decoration: canceled ? TextDecoration.lineThrough : null,
                color: canceled ? Colors.grey.shade500 : null,
              )),
        ],
      ),
    );
  }

  /// 금액 요약 — 상품 합계·배송비·총액 전부 서버 계산 값 (AD-12)
  Widget _summary(Map<String, dynamic> order) {
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row('상품 합계', order['item_total'] as int),
        row('배송비', order['shipping_total'] as int),
        const Divider(height: 20),
        row('총 결제 금액', order['grand_total'] as int, bold: true),
      ],
    );
  }

  /// 입금 안내 박스 — deposit_info != null(입금대기)일 때만 표시
  Widget _depositBox(Map<String, dynamic> deposit) {
    final dueAtRaw = deposit['deposit_due_at'];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('입금 안내', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _infoRow('입금 금액', '${formatWon(deposit['grand_total'] as int)}원'),
          _infoRow('입금 계좌', '${deposit['deposit_account']}'),
          _infoRow('입금 기한', dueAtRaw is String ? formatDueAt(dueAtRaw) : '-'),
        ],
      ),
    );
  }
}
