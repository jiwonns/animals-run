import { useCatalog } from '@/providers/catalog-provider';
import { ScrollView } from '@/components/refreshable';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

const EFFECTIVE_DATE = '2026년 10월 18일';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '제1조 (목적)',
    body: ['이 약관은 서비스(이하 "서비스")를 이용하는 회원과 운영자 사이의 권리, 의무 및 책임을 정합니다.'],
  },
  {
    title: '제2조 (회원가입과 계정)',
    body: [
      '회원은 아이디, 비밀번호, 생년월일을 입력해 가입합니다. 생년월일은 가입 보상(띠 동물) 지급에만 사용합니다.',
      '계정은 본인만 사용해야 하며, 비밀번호 관리 책임은 회원에게 있습니다.',
      '다른 사람의 정보를 도용하거나 서비스 운영을 방해할 목적으로 가입할 수 없습니다.',
    ],
  },
  {
    title: '제3조 (걸음 수와 위치 정보)',
    body: [
      '서비스는 회원의 기기에서 측정한 걸음 수를 코인 지급과 랭킹에 사용합니다.',
      '지도 기능을 켜면 현재 위치가 아이디, 대표 동물과 함께 다른 회원에게 표시됩니다. 지도 화면에서 언제든 공유를 끌 수 있습니다.',
      '걸음 측정 범위는 환경설정의 "앱이 켜져 있을 때만 걸음 세기"로 바꿀 수 있습니다.',
    ],
  },
  {
    title: '제4조 (게임 재화와 아이템)',
    body: [
      '코인, 뽑기권, 동물, 알 등 서비스 안의 재화와 아이템은 서비스 안에서만 쓸 수 있으며 현금으로 바꾸거나 다른 사람에게 양도할 수 없습니다.',
      '뽑기, 교배, 합성 등의 확률과 비용은 서비스 화면에 안내하며, 운영상 필요에 따라 바뀔 수 있습니다.',
    ],
  },
  {
    title: '제5조 (랭킹)',
    body: ['누적 걸음 수와 등급별 동물 보유 수는 아이디, 대표 동물과 함께 다른 회원에게 공개되는 랭킹에 표시됩니다.'],
  },
  {
    title: '제6조 (금지 행위)',
    body: [
      '걸음 수를 조작하는 기기나 프로그램 사용, 버그 악용, 비정상적인 방법으로 재화를 얻는 행위를 금지합니다.',
      '금지 행위가 확인되면 운영자는 해당 재화를 회수하거나 이용을 제한할 수 있습니다.',
    ],
  },
  {
    title: '제7조 (회원탈퇴)',
    body: [
      '회원은 환경설정에서 언제든 탈퇴할 수 있습니다.',
      '탈퇴하면 계정과 함께 모든 재화, 동물, 기록, 랭킹 정보가 즉시 삭제되며 복구할 수 없습니다.',
    ],
  },
  {
    title: '제8조 (서비스의 변경과 중단)',
    body: [
      '운영자는 서비스의 내용을 바꾸거나 점검을 위해 일시 중단할 수 있으며, 중요한 변경은 미리 알립니다.',
      '천재지변, 외부 서비스 장애 등 운영자가 통제할 수 없는 사유로 생긴 손해에는 책임지지 않습니다.',
    ],
  },
  {
    title: '제9조 (약관의 변경)',
    body: ['약관이 바뀌면 시행일과 내용을 서비스 안에 알리며, 바뀐 약관에 동의하지 않으면 탈퇴할 수 있습니다.'],
  },
];

export default function TermsScreen() {
  useCatalog();
  const colors = useColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Text style={[styles.date, { color: colors.secondary }]}>시행일 {EFFECTIVE_DATE}</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>{section.title}</Text>
          {section.body.map((line, i) => (
            <Text key={i} style={[styles.body, { color: colors.text }]}>
              {section.body.length > 1 ? `${i + 1}. ` : ''}
              {line}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  date: {
    fontSize: 13,
  },
  section: {
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
});
