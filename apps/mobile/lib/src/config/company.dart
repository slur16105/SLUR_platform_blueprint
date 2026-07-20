/// 사업자 정보 단일 소스 — 웹 app/config/company.ts와 동일 값 유지.
/// 오픈 게이트 실값 교체: 아래 placeholder 값들은 실서비스 오픈 전 실제 값으로 교체할 것.
class Company {
  Company._();

  static const name = '(주)슬러'; // 오픈 게이트 실값 교체
  static const representative = 'OOO'; // 오픈 게이트 실값 교체
  static const businessRegistrationNumber = '000-00-00000'; // 오픈 게이트 실값 교체
  static const mailOrderNumber = '제0000-서울-0000호'; // 오픈 게이트 실값 교체
  static const address = '서울특별시 OO구 OO로 00'; // 오픈 게이트 실값 교체
  static const phone = '0000-0000'; // 오픈 게이트 실값 교체
  static const email = 'contact@slur.example'; // 오픈 게이트 실값 교체

  /// 통신판매중개자 고지 (전자상거래법) — 회사명(name)에서 파생
  static const brokerNotice =
      '$name는 통신판매중개자이며 통신판매의 당사자가 아닙니다. '
      '상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다.';

  // TODO(오픈 게이트): 커스텀 도메인으로 교체.
  // 빌드 시 --dart-define=WEB_BASE_URL=... 으로 주입 가능.
  static const _webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'https://web-production-abfe1.up.railway.app',
  );
  static const termsUrl = '$_webBaseUrl/terms';
  static const privacyUrl = '$_webBaseUrl/privacy';
}
