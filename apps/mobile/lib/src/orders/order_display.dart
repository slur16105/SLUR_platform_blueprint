import 'package:flutter/material.dart';

/// display_status → 한국어 라벨 — 서버 상태 값을 표시만 매핑 (AD-12: 클라이언트 파생 금지)
String displayStatusLabel(String status) {
  switch (status) {
    case 'awaiting_payment':
      return '입금대기';
    case 'preparing':
      return '배송준비';
    case 'shipping':
      return '배송중';
    case 'delivered':
      return '배송완료';
    case 'canceled':
      return '취소완료';
    default:
      return status; // 알 수 없는 값은 원문 그대로 (크래시 방지)
  }
}

Color _statusColor(String status) {
  switch (status) {
    case 'awaiting_payment':
      return Colors.orange.shade800;
    case 'preparing':
      return Colors.blue.shade700;
    case 'shipping':
      return Colors.indigo.shade600;
    case 'delivered':
      return Colors.green.shade700;
    case 'canceled':
      return Colors.grey.shade600;
    default:
      return Colors.grey.shade600;
  }
}

/// 주문 상태 뱃지 — 상태별 색상의 작은 라벨
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        displayStatusLabel(status),
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

/// ISO 문자열 → 로컬 yyyy.MM.dd (계산 없음 — 서버 값 포맷만)
String formatOrderDate(String iso) {
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  final mm = dt.month.toString().padLeft(2, '0');
  final dd = dt.day.toString().padLeft(2, '0');
  return '${dt.year}.$mm.$dd';
}

/// ISO 문자열 → 로컬 "yyyy년 M월 d일 HH:mm" (입금 기한 표시용)
String formatDueAt(String iso) {
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  final hh = dt.hour.toString().padLeft(2, '0');
  final mm = dt.minute.toString().padLeft(2, '0');
  return '${dt.year}년 ${dt.month}월 ${dt.day}일 $hh:$mm';
}
