import 'package:flutter/material.dart';

import '../format.dart';

/// 주문 완료 화면 — 표시 값 전부 주문 생성 응답(서버 계산 값) 그대로 (AD-12)
class OrderCompleteScreen extends StatelessWidget {
  const OrderCompleteScreen({super.key, required this.result});

  /// createOrder 201 응답: {order_id, grand_total, deposit_account, deposit_due_at}
  final Map<String, dynamic> result;

  String _formatDueAt(String iso) {
    // ISO 문자열을 로컬 시각으로 변환해 표시 (계산 없음 — 서버 값 포맷만)
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.year}년 ${dt.month}월 ${dt.day}일 $hh:$mm';
  }

  /// 시스템 back — 입금 안내 확인 다이얼로그 후 홈으로 (주문서 재진입 없음)
  Future<void> _confirmLeave(BuildContext context) async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: const Text('입금 안내를 확인하셨나요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('머무르기'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (leave == true && context.mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 주문 성공 직후 화면 — 형 불일치가 있어도 절대 크래시하지 않는다 (안전 접근)
    final grandTotalRaw = result['grand_total'];
    final grandTotal = grandTotalRaw is int
        ? '${formatWon(grandTotalRaw)}원'
        : '${grandTotalRaw ?? '-'}';
    final depositAccount = '${result['deposit_account'] ?? '-'}';
    final depositDueAtRaw = result['deposit_due_at'];
    final depositDueAt = depositDueAtRaw is String
        ? _formatDueAt(depositDueAtRaw)
        : '-';

    Widget infoRow(String label, String value) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 96,
              child: Text(
                label,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return PopScope(
      // 시스템 back 차단 — 확인 다이얼로그 거쳐 홈으로만 이동
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave(context);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('주문 완료'),
          automaticallyImplyLeading: false,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              const Icon(
                Icons.check_circle_outline,
                size: 72,
                color: Colors.green,
              ),
              const SizedBox(height: 16),
              const Center(
                child: Text(
                  '주문이 접수되었습니다',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  '입금이 확인되면 주문이 확정됩니다.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
              ),
              const SizedBox(height: 32),
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      infoRow('총 결제 금액', grandTotal),
                      infoRow('입금 계좌', depositAccount),
                      infoRow('입금 기한', depositDueAt),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              FilledButton(
                // 홈(첫 화면)까지 전부 pop — 주문서·장바구니로 되돌아가지 않는다
                onPressed: () =>
                    Navigator.of(context).popUntil((route) => route.isFirst),
                child: const Text('쇼핑 계속하기'),
              ),
              TextButton(
                onPressed: null, // 5.1 주문 내역 화면에서 연결
                child: const Text('주문 내역 보기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
