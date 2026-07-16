import 'package:dio/dio.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart' as kakao;

import '../api/client.dart';

class AuthRepository {
  AuthRepository(this._api, this._storage);
  final ApiClient _api;
  final TokenStorage _storage;

  Future<void> _saveTokens(Map<String, dynamic> data) =>
      _storage.save(data['access_token'] as String, data['refresh_token'] as String);

  Future<void> signup(String email, String password, String name, String? phone) async {
    try {
      final res = await _api.dio.post('/api/v1/auth/signup',
          data: {
            'email': email,
            'password': password,
            'name': name,
            if (phone != null && phone.isNotEmpty) 'phone': phone,
          },
          options: Options(extra: {'noAuth': true}));
      await _saveTokens(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> login(String email, String password) async {
    try {
      final res = await _api.dio.post('/api/v1/auth/login',
          data: {'email': email, 'password': password}, options: Options(extra: {'noAuth': true}));
      await _saveTokens(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.from(e);
    }
  }

  /// 카카오 원탭 로그인: 카톡 설치 시 앱 전환, 아니면 계정 로그인 폴백
  Future<void> loginWithKakao() async {
    kakao.OAuthToken kakaoToken;
    if (await kakao.isKakaoTalkInstalled()) {
      try {
        kakaoToken = await kakao.UserApi.instance.loginWithKakaoTalk();
      } catch (_) {
        kakaoToken = await kakao.UserApi.instance.loginWithKakaoAccount();
      }
    } else {
      kakaoToken = await kakao.UserApi.instance.loginWithKakaoAccount();
    }
    try {
      final res = await _api.dio.post('/api/v1/auth/kakao/native',
          data: {'kakao_access_token': kakaoToken.accessToken}, options: Options(extra: {'noAuth': true}));
      await _saveTokens(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.from(e);
    } finally {
      // 카카오 SDK가 평문 저장한 토큰은 신원 교환 후 즉시 파기 (AD-5 정신)
      try {
        await kakao.UserApi.instance.logout();
      } catch (_) {/* 파기 실패는 치명 아님 */}
    }
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      final res = await _api.dio.get('/api/v1/auth/me');
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return null; // 미인증만 null — 오프라인은 에러로 전파
      rethrow;
    }
  }

  Future<void> logout() async {
    final refresh = await _storage.refresh;
    if (refresh != null) {
      try {
        // noAuth: access 만료로 인한 401→회전 경로를 타지 않게 (구 refresh 잔존 방지)
        await _api.dio.post('/api/v1/auth/logout',
            data: {'refresh_token': refresh}, options: Options(extra: {'noAuth': true}));
      } on DioException {
        // 멱등 — 서버 실패해도 로컬은 지운다
      }
    }
    await _storage.clear();
  }
}
