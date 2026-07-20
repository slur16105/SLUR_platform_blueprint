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
}
