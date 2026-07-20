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
    required int expectedGrandTotal,
  }) async {
    try {
      final res = await _dio.post('/api/v1/orders', data: {
        'cart_item_ids': cartItemIds,
        // 미리보기의 grand_total 그대로 — 서버가 불일치 시 409 price_changed로 거부
        'expected_grand_total': expectedGrandTotal,
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

  /// 주문 목록 (최신순 페이지네이션) — 응답: {items, total, page}
  Future<Map<String, dynamic>> listOrders({int page = 1}) async {
    try {
      final res =
          await _dio.get('/api/v1/orders', queryParameters: {'page': page});
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  /// 주문 상세 — 금액·상태·cancellable 전부 서버 값 표시만 (AD-12)
  Future<Map<String, dynamic>> getOrder(String orderId) async {
    try {
      final res = await _dio.get('/api/v1/orders/$orderId');
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  /// 판매자 묶음(sub_order) 취소 — 응답: {canceled_items, order_canceled}
  Future<Map<String, dynamic>> cancelSubOrder(String subOrderId,
      {String? reason}) async {
    try {
      final res = await _dio.post(
        '/api/v1/orders/sub-orders/$subOrderId/cancel',
        data: (reason == null || reason.isEmpty) ? <String, dynamic>{} : {'reason': reason},
      );
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }
}
