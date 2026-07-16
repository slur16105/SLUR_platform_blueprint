import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key, required this.user});
  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SLUR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(currentUserProvider.notifier).logout(),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('${user['name']}님, 환영합니다', style: const TextStyle(fontSize: 20)),
            if (user['email'] != null) Text(user['email'] as String),
            const SizedBox(height: 8),
            const Text('상품 화면은 곧 생깁니다 (Epic 3)'),
          ],
        ),
      ),
    );
  }
}
