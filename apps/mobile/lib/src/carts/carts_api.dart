import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../auth/auth_provider.dart';

/// 장바구니 조회 — 합계·구매 가능 여부는 전부 서버 계산 값 (AD-12)
final cartProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final dio = ref.watch(apiClientProvider).dio;
  final res = await dio.get('/api/v1/carts'); // 인증 필수 (noAuth 없음 — 토큰 자동 첨부)
  return res.data as Map<String, dynamic>;
});

final cartApiProvider = Provider<CartApi>((ref) => CartApi(ref.watch(apiClientProvider).dio));

class CartApi {
  CartApi(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> add(String variantId, int quantity) async {
    try {
      final res = await _dio.post('/api/v1/carts/items',
          data: {'variant_id': variantId, 'quantity': quantity});
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> updateQuantity(String itemId, int quantity) async {
    try {
      await _dio.patch('/api/v1/carts/items/$itemId', data: {'quantity': quantity});
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> remove(String itemId) async {
    try {
      await _dio.delete('/api/v1/carts/items/$itemId');
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }
}
