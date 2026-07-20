import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/client.dart';
import '../format.dart';
import 'order_detail_screen.dart';
import 'order_display.dart';
import 'orders_api.dart';

/// 주문 내역 화면 — 최신순 카드 목록 + 스크롤 끝 도달 시 다음 페이지 로드
class OrderHistoryScreen extends ConsumerStatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  ConsumerState<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends ConsumerState<OrderHistoryScreen> {
  final List<Map<String, dynamic>> _items = [];
  int _total = 0;
  int _page = 0; // 마지막으로 로드한 페이지 (0 = 미로드)
  bool _refreshing = false; // 첫 페이지(새로고침) 로드 중
  bool _loadingMore = false; // 다음 페이지 로드 중
  bool _initialLoaded = false; // 첫 페이지 로드 완료 여부
  int _generation = 0; // 새로고침 세대 — 진행 중이던 _loadMore 결과의 뒤늦은 반영 방지
  String? _error;

  // 서버 total 기준으로만 다음 페이지 존재 판단 (items.length < total)
  bool get _hasMore => _items.length < _total;

  @override
  void initState() {
    super.initState();
    _loadFirst();
  }

  /// 첫 페이지 로드 (당겨서 새로고침 시에도 사용 — 목록 초기화 후 재조회)
  /// 진행 중인 _loadMore와 무관하게 항상 실행된다 (세대 증가로 이전 결과 무효화)
  Future<void> _loadFirst() async {
    if (_refreshing) return;
    _generation++; // 진행 중이던 _loadMore 응답은 세대 불일치로 폐기됨
    setState(() {
      _refreshing = true;
      _error = null;
    });
    try {
      final body = await ref.read(ordersApiProvider).listOrders(page: 1);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll((body['items'] as List).cast<Map<String, dynamic>>());
        _total = body['total'] as int;
        _page = 1;
        _initialLoaded = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  /// 다음 페이지 로드 — items.length < total일 때만
  Future<void> _loadMore() async {
    if (_refreshing || _loadingMore || !_initialLoaded || !_hasMore) return;
    final generation = _generation; // 요청 시점 세대 기록
    setState(() => _loadingMore = true);
    try {
      final body = await ref.read(ordersApiProvider).listOrders(page: _page + 1);
      if (!mounted || generation != _generation) return; // 새로고침이 끼어들었으면 폐기
      setState(() {
        // offset 페이징 중 새 주문 유입으로 밀려 내려온 중복 카드 제거
        final seen = {for (final o in _items) o['order_id']};
        _items.addAll((body['items'] as List)
            .cast<Map<String, dynamic>>()
            .where((o) => !seen.contains(o['order_id'])));
        _total = body['total'] as int;
        _page = body['page'] as int;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('오류가 발생했습니다. 다시 시도해 주세요.')));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('주문 내역')),
      body: !_initialLoaded && _refreshing
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await _loadFirst();
              },
              child: _body(),
            ),
    );
  }

  Widget _body() {
    // 첫 로드 실패 — 새로고침으로 재시도할 수 있게 스크롤 가능한 안내
    if (!_initialLoaded) {
      return _scrollableMessage(_error ?? '주문 내역을 불러오지 못했습니다.');
    }
    if (_items.isEmpty) {
      return _scrollableMessage('주문 내역이 없습니다');
    }
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        // 스크롤 끝 근처 도달 시 다음 페이지 로드
        if (n.metrics.pixels >= n.metrics.maxScrollExtent - 200) _loadMore();
        return false;
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        itemCount: _items.length + (_hasMore ? 1 : 0),
        separatorBuilder: (_, s) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          if (i == _items.length) {
            // 다음 페이지 로딩 표시
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _orderCard(_items[i]);
        },
      ),
    );
  }

  /// RefreshIndicator가 동작하도록 스크롤 가능한 형태의 안내 문구
  Widget _scrollableMessage(String message) {
    return LayoutBuilder(
      builder: (context, constraints) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: constraints.maxHeight,
            child: Center(
              child: Text(message, style: TextStyle(color: Colors.grey.shade600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    final subOrders =
        (order['sub_orders'] as List? ?? const []).cast<Map<String, dynamic>>();
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) =>
                OrderDetailScreen(orderId: order['order_id'] as String),
          ));
          if (mounted) _loadFirst(); // 상세에서 취소했을 수 있으므로 목록 갱신
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('주문번호 ${order['order_no']}',
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 8),
                  Text(formatOrderDate(order['created_at'] as String),
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  const Spacer(),
                  StatusBadge(status: order['display_status'] as String),
                ],
              ),
              const SizedBox(height: 8),
              // 대표 상품명 ("외 n건" 포함 문자열 — 서버 조립 값 그대로)
              Text(order['title'] as String,
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              if (subOrders.isNotEmpty) ...[
                const SizedBox(height: 8),
                // 판매자 묶음별 브랜드 + 상태 칩
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final sub in subOrders)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${sub['brand_name']} · ${displayStatusLabel(sub['display_status'] as String)}',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey.shade700),
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: Text('${formatWon(order['grand_total'] as int)}원',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
