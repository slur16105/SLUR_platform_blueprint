import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../auth/auth_provider.dart';

final ordersApiProvider = Provider<OrdersApi>((ref) => OrdersApi(ref.watch(apiClientProvider).dio));

class OrdersApi {
  OrdersApi(this._dio);
  final Dio _dio;

  /// 주문서 미리보기 — 금액·배송비는 전부 서버 계산 값 (AD-12)
  /// 응답: {seller_groups, item_total, shipping_total, grand_total, remote_area_kind}
  Future<Map<String, dynamic>> preview(String postalCode) async {
    try {
      final res = await _dio.post('/api/v1/orders/preview',
          data: {'postal_code': postalCode}); // 인증 필수 (noAuth 없음 — 토큰 자동 첨부)
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  /// 주문 생성 — 201 응답 {order_id, grand_total, deposit_account, deposit_due_at}
  /// 금액·입금 정보 전부 서버 계산 값 (AD-12)
  Future<Map<String, dynamic>> createOrder({
    required List<String> cartItemIds,
    required String postalCode,
    required String recipientName,
    required String recipientPhone,
    required String address1,
    required String address2,
    required String orderNote,
  }) async {
    try {
      final res = await _dio.post('/api/v1/orders', data: {
        'cart_item_ids': cartItemIds,
        'postal_code': postalCode,
        'recipient_name': recipientName,
        'recipient_phone': recipientPhone,
        'address1': address1,
        'address2': address2,
        'order_note': orderNote,
      });
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }
}
