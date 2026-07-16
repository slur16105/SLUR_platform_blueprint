import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';

import 'src/auth/auth_provider.dart';
import 'src/screens/home_screen.dart';
import 'src/screens/login_screen.dart';

const _kakaoNativeAppKey = String.fromEnvironment('KAKAO_NATIVE_APP_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (_kakaoNativeAppKey.isNotEmpty) {
    await KakaoSdk.init(nativeAppKey: _kakaoNativeAppKey);
  }
  runApp(const ProviderScope(child: SlurApp()));
}

class SlurApp extends ConsumerWidget {
  const SlurApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return MaterialApp(
      title: 'SLUR',
      theme: ThemeData(colorSchemeSeed: Colors.black, useMaterial3: true),
      home: user.when(
        loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (_, s) => const LoginScreen(),
        data: (u) => u == null ? const LoginScreen() : HomeScreen(user: u),
      ),
    );
  }
}
