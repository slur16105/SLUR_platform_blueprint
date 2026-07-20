import 'package:flutter/material.dart';

import '../config/company.dart';

/// 서비스 정보 — 사업자 정보·통신판매중개자 고지·약관/개인정보처리방침 (Story 6.1)
class ServiceInfoScreen extends StatelessWidget {
  const ServiceInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('서비스 정보')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('사업자 정보',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _infoRow('회사명', Company.name),
          _infoRow('대표', Company.representative),
          _infoRow('사업자등록번호', Company.businessRegistrationNumber),
          _infoRow('통신판매업신고', Company.mailOrderNumber),
          _infoRow('주소', Company.address),
          _infoRow('연락처', Company.phone),
          _infoRow('이메일', Company.email),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              Company.brokerNotice,
              style: TextStyle(fontSize: 12, height: 1.5, color: Colors.grey.shade700),
            ),
          ),
          const SizedBox(height: 20),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('이용약관'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showUrlDialog(context, '이용약관', Company.termsUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('개인정보처리방침'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showUrlDialog(context, '개인정보처리방침', Company.privacyUrl),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  /// url_launcher 미사용 — URL을 보여주고 브라우저에서 직접 열도록 안내
  void _showUrlDialog(BuildContext context, String title, String url) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('아래 주소를 브라우저에서 열어주세요.',
                style: TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            SelectableText(url, style: const TextStyle(fontSize: 13)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('닫기'),
          ),
        ],
      ),
    );
  }
}
