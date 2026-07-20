// 사업자 정보 단일 소스 — 푸터·정책 페이지가 여기만 참조한다.
// TODO(오픈 게이트): 아래 값은 전부 placeholder. 실서비스 오픈 전 실제 사업자 등록 정보로 교체할 것.
export const COMPANY = {
  name: "(주)슬러",
  representative: "OOO",
  businessRegistrationNumber: "000-00-00000",
  mailOrderNumber: "제0000-서울-0000호",
  address: "서울특별시 OO구 OO로 00",
  contact: "0000-0000",
  email: "contact@slur.example",
} as const;

export const BROKER_NOTICE =
  "(주)슬러는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다.";
