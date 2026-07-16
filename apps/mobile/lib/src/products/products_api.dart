import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';

final categoriesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final dio = ref.watch(apiClientProvider).dio;
  final res = await dio.get('/api/v1/products/categories', options: Options(extra: {'noAuth': true}));
  return (res.data as List).cast<Map<String, dynamic>>();
});

final productListProvider =
    FutureProvider.family<Map<String, dynamic>, String?>((ref, categoryId) async {
  final dio = ref.watch(apiClientProvider).dio;
  final res = await dio.get('/api/v1/products',
      queryParameters: {'category': ?categoryId},
      options: Options(extra: {'noAuth': true}));
  return res.data as Map<String, dynamic>;
});

final productDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final dio = ref.watch(apiClientProvider).dio;
  final res = await dio.get('/api/v1/products/$id', options: Options(extra: {'noAuth': true}));
  return res.data as Map<String, dynamic>;
});
