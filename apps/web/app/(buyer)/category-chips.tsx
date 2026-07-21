/* 카테고리 칩 행 — 가로 스크롤, 단일 선택, 맨 앞은 언제나 `전체`.
   🚨 이름·순서·개수를 코드에 하드코딩하지 않는다 (FR-34). 운영자가 관리하는 값이며
      서버가 sort_order로 정렬해 내려주므로 클라이언트가 재정렬하지도 않는다.

   조회를 여기서 하지 않고 목록 본체(product-list)가 하는 이유:
   URL의 ?category가 응답에 없는 값일 때 조용히 정리해야 하는데,
   그 판정과 목록 재조회가 한 곳에 있어야 순서가 흔들리지 않는다.
   조회 실패 시 목록 본체가 이 컴포넌트를 아예 렌더하지 않는다 — 목록은 정상 표시된다. */

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export default function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  /** null = `전체` */
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="b_chips">
      {/* b_container를 함께 걸어 칩 행이 본문(≥768에서 1080px 가운데 정렬)과 같은 축에 선다 */}
      <div className="b_container i_scroll" role="group" aria-label="카테고리">
        <button
          type="button"
          className="b_chip b_control"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          전체
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="b_chip b_control"
            aria-pressed={selected === c.id}
            onClick={() => onSelect(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
