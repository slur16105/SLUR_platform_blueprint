/// 사업자 정보 단일 소스 — 웹 app/config/company.ts와 동일 값 유지.
/// 오픈 게이트 실값 교체: 아래 placeholder 값들은 실서비스 오픈 전 실제 값으로 교체할 것.
class Company {
  Company._();

  static const name = '(주)슬러';
  static const representative = 'OOO'; // 오픈 게이트 실값 교체
  static const businessRegistrationNumber = '000-00-00000'; // 오픈 게이트 실값 교체
  static const mailOrderNumber = '제0000-서울-0000호'; // 오픈 게이트 실값 교체
  static const address = '서울특별시 OO구 OO로 00'; // 오픈 게이트 실값 교체
  static const phone = '0000-0000'; // 오픈 게이트 실값 교체
  static const email = 'contact@slur.example'; // 오픈 게이트 실값 교체

  /// 통신판매중개자 고지 (전자상거래법)
  static const brokerNotice =
      '(주)슬러는 통신판매중개자이며 통신판매의 당사자가 아닙니다. '
      '상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다.';

  static const termsUrl = 'https://web-production-abfe1.up.railway.app/terms';
  static const privacyUrl = 'https://web-production-abfe1.up.railway.app/privacy';
}
