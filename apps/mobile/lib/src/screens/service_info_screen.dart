import 'package:flutter/material.dart';

import '../config/company.dart';
import '../config/policy_texts.dart';

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
            onTap: () => _openPolicy(context, PolicyTexts.termsTitle,
                PolicyTexts.termsBody, Company.termsUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('개인정보처리방침'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _openPolicy(context, PolicyTexts.privacyTitle,
                PolicyTexts.privacyBody, Company.privacyUrl),
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

  void _openPolicy(BuildContext context, String title, String body, String url) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PolicyScreen(title: title, body: body, webUrl: url),
    ));
  }
}

/// 약관·개인정보처리방침 인앱 정적 표시 (Story 6.1)
class PolicyScreen extends StatelessWidget {
  const PolicyScreen({
    super.key,
    required this.title,
    required this.body,
    required this.webUrl,
  });

  final String title;
  final String body;
  final String webUrl;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 초안 배너
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              PolicyTexts.draftNotice,
              style: TextStyle(
                  fontSize: 12, height: 1.5, color: Colors.orange.shade900),
            ),
          ),
          const SizedBox(height: 16),
          Text(body, style: const TextStyle(fontSize: 13, height: 1.6)),
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),
          Text('웹에서 보기 (브라우저에 주소를 입력해 주세요)',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          // url_launcher 미사용 — 선택 가능한 URL 텍스트로 안내
          SelectableText(webUrl, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
