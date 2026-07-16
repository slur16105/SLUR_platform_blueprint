import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import 'auth_repository.dart';

final tokenStorageProvider = Provider((ref) => TokenStorage());
final apiClientProvider = Provider((ref) => ApiClient(ref.watch(tokenStorageProvider)));
final authRepositoryProvider =
    Provider((ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStorageProvider)));

/// 현재 사용자 (null = 미로그인). 앱 시작 시 저장된 토큰으로 me 조회 → 자동 로그인.
final currentUserProvider = AsyncNotifierProvider<CurrentUser, Map<String, dynamic>?>(CurrentUser.new);

class CurrentUser extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async {
    final storage = ref.read(tokenStorageProvider);
    if (await storage.access == null && await storage.refresh == null) return null;
    return ref.read(authRepositoryProvider).me();
  }

  Future<void> refreshUser() async {
    state = AsyncData(await ref.read(authRepositoryProvider).me());
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}
