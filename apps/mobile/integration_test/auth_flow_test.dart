// 이메일 가입 → 홈 → 로그아웃 → 로그인 E2E (프로덕션 API 대상)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:slur_mobile/main.dart' as app;

const email = 'e2e-flutter@example.com';
const password = 'e2e-password-123';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('이메일 가입 → 홈 → 로그아웃 → 재로그인', (tester) async {
    await app.main();
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // 로그인 화면 → 가입 화면
    expect(find.text('SLUR'), findsOneWidget);
    await tester.tap(find.text('이메일로 가입하기'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, '이메일'), email);
    await tester.enterText(find.widgetWithText(TextField, '비밀번호 (8자 이상)'), password);
    await tester.enterText(find.widgetWithText(TextField, '이름'), 'E2E테스터');
    await tester.tap(find.text('가입하기'));
    await tester.pumpAndSettle(const Duration(seconds: 5));

    // 홈 진입
    expect(find.textContaining('환영합니다'), findsOneWidget);

    // 로그아웃 → 로그인 화면
    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle(const Duration(seconds: 3));
    expect(find.text('로그인'), findsWidgets);

    // 재로그인
    await tester.enterText(find.widgetWithText(TextField, '이메일'), email);
    await tester.enterText(find.widgetWithText(TextField, '비밀번호'), password);
    await tester.tap(find.widgetWithText(FilledButton, '로그인'));
    await tester.pumpAndSettle(const Duration(seconds: 5));
    expect(find.textContaining('환영합니다'), findsOneWidget);
  });
}
