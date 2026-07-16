import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// API 베이스 URL — --dart-define=API_BASE_URL=... (기본: 프로덕션)
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api-production-8bfb.up.railway.app',
);

class TokenStorage {
  // flutter_secure_storage 10.x 기본이 Keystore 기반 암호화 (별도 옵션 불필요)
  static const _storage = FlutterSecureStorage();

  Future<String?> get access async => _storage.read(key: 'access_token');
  Future<String?> get refresh async => _storage.read(key: 'refresh_token');

  Future<void> save(String access, String refresh) async {
    // 회전 직후 부분 실패 방지 — 둘 다 쓰고, 실패 시 전체 클리어(다음 시작 시 재로그인)
    try {
      await Future.wait([
        _storage.write(key: 'access_token', value: access),
        _storage.write(key: 'refresh_token', value: refresh),
      ]);
    } catch (_) {
      await clear();
      rethrow;
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
}

/// 에러 봉투 {code, message, details} — 클라이언트는 code로 분기, message는 그대로 표시
class ApiException implements Exception {
  ApiException(this.code, this.message);
  final String code;
  final String message;

  static ApiException from(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['code'] is String) {
      return ApiException(data['code'] as String, data['message'] as String? ?? '오류가 발생했습니다.');
    }
    return ApiException('network_error', '네트워크 연결을 확인해 주세요.');
  }
}

class ApiClient {
  ApiClient(this._storage, {this.onSessionExpired}) {
    _dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));
    _dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = await _storage.access;
      if (token != null && options.extra['noAuth'] != true) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    }, onError: (error, handler) async {
      // 401 → 단일 refresh 후 재시도 (동시 401은 refresh 회전 레이스를 피하기 위해 한 번만)
      final code = (error.response?.data is Map) ? error.response!.data['code'] : null;
      if (error.response?.statusCode == 401 &&
          code == 'unauthorized' &&
          error.requestOptions.extra['retried'] != true) {
        final ok = await _refreshOnce();
        if (ok) {
          final opts = error.requestOptions..extra['retried'] = true;
          try {
            return handler.resolve(await _dio.fetch(opts));
          } on DioException catch (e) {
            return handler.next(e);
          }
        }
      }
      handler.next(error);
    }));
  }

  late final Dio _dio;
  final TokenStorage _storage;
  final void Function()? onSessionExpired; // 갱신 실패 → 로그인 화면 전환 배선 (AC 2)
  Future<bool>? _refreshing; // 단일 비행(single-flight) 보장

  Dio get dio => _dio;

  Future<bool> _refreshOnce() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _storage.refresh;
    if (refresh == null) return false;
    try {
      final res = await _dio.post('/api/v1/auth/refresh',
          data: {'refresh_token': refresh}, options: Options(extra: {'noAuth': true}));
      await _storage.save(res.data['access_token'] as String, res.data['refresh_token'] as String);
      return true;
    } catch (_) {
      // DioException 외(캐스트·스토리지 오류)도 세션 종료로 수렴
      await _storage.clear();
      onSessionExpired?.call(); // 세션 중 갱신 실패 → 즉시 로그인 화면 (AC 2)
      return false;
    }
  }
}
