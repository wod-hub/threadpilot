/* =========================================================================
   ThreadPilot — 스레드 예약 발행 · 댓글 자동 답글 (데모 PWA)
   상태는 localStorage에 저장되고, 발행은 시뮬레이션입니다.
   ========================================================================= */
(function () {
  'use strict';

  const STORE_KEY = 'threadpilot.state.v1';
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  // 운영사 표기 — ThreadPilot은 붐비다(BUMBIDA)가 운영하는 자동화 스튜디오 제품입니다.
  // 사업자번호·연락처 같은 정보는 실제 확인된 값이 없으므로 화면에 쓰지 않습니다.
  const OPERATOR = { ko: '붐비다', en: 'BUMBIDA', studio: '붐비다 자동화 스튜디오' };
  const OP_LINE = '운영 · ' + OPERATOR.ko + ' (' + OPERATOR.en + ')';
  // 실제 붐비다 로고 — bumbida.com 공식 SVG. 운영사 표기 옆에 이 파일을 그대로 씁니다.
  const OP_LOGO = 'icons/bumbida-logo.svg';

  /* ---------------------------------------------------------------- 상수 */
  const TONES = [
    { id: 'friendly', label: '친근한', hint: '해요체로 다정하게' },
    { id: 'pro', label: '전문적', hint: '근거와 숫자 중심' },
    { id: 'humor', label: '유머러스', hint: '가볍게 한 번' },
    { id: 'plain', label: '담백한', hint: '짧고 군더더기 없이' }
  ];
  const TONE_LABEL = {};
  TONES.forEach(t => { TONE_LABEL[t.id] = t.label; });

  // 말투(formality) — 톤과 별개 축. 발행 글·댓글 답글 양쪽에 함께 적용됩니다.
  const FORMALITIES = [
    { id: 'casual', label: '반말', hint: '스레드처럼 편하게 — "~했어", "~해"', sample: '무게보다 자세야. 자세가 무너지면 거기서 멈추는 게 맞아.' },
    { id: 'formal', label: '존댓말', hint: '정중하게 — "~했어요", "~합니다"', sample: '무게보다 자세입니다. 자세가 무너지면 거기서 멈추는 게 맞아요.' }
  ];
  const FORMALITY_LABEL = {};
  FORMALITIES.forEach(f => { FORMALITY_LABEL[f.id] = f.label; });

  // 톤 설명은 말투에 따라 문장이 달라집니다(예: 해요체 → 반말).
  function toneHint(tone, formality) {
    if (tone === 'friendly') return formality === 'formal' ? '해요체로 다정하게' : '반말로 다정하게, 말 걸듯이';
    const t = TONES.find(x => x.id === tone) || TONES[0];
    return t.hint;
  }

  const DEMO_ACCOUNTS = [
    { handle: '@lastone.training', name: '라스트원 트레이닝', color: '#FF3B5C' },
    { handle: '@lastone.gym', name: '라스트원 양주점', color: '#111114' },
    { handle: '@vandal.belt', name: 'VANDAL 벨트', color: '#6C5CE7' }
  ];

  const TAGS = {
    '크로스핏': ['#크로스핏', '#라스트원트레이닝'],
    '헬스장 운영': ['#헬스장운영', '#크로스핏박스'],
    '창업': ['#창업', '#1인사업'],
    '_': ['#오늘의기록', '#꾸준함']
  };

  /* 템플릿 뱅크: 말투(formality) 두 벌 × 톤(tone) 네 가지.
     casual = 반말(~했어 / ~해), formal = 존댓말(~했어요 / ~합니다).
     어미 변환 대신 문장을 두 벌로 직접 써서 어색한 치환이 생기지 않게 했습니다. */
  const GEN = {
    casual: {
      friendly: {
        hooks: [
          '오늘 아침 수업 끝나고 다들 바닥에 누워 있었어. 나도.',
          '회원 한 분이 오늘 이런 말을 하더라.',
          '솔직히 나도 어제는 운동을 건너뛰었어. 응, 맞아.',
          '이번 주도 수업이 꽉 찼어. 진심으로 고마워.',
          '3년 전 첫 회원이 오늘 다시 왔어.',
          '오늘 처음 온 사람, 첫 동작에서 표정이 확 굳더라. 다 그래.',
          '저녁 수업 끝나고 기구 정리하다가 문득 생각이 났어.',
          '아침 6시 50분에 문 열면, 제일 먼저 오는 사람이 있어.'
        ],
        middles: {
          '크로스핏': [
            '크로스핏은 잘하는 사람이 하는 게 아니라, 오늘 온 사람이 하는 거야.',
            '처음 오면 다들 데드리프트에서 눈이 풀려. 나도 그랬고, 지금도 그래.',
            '50분이 길어 보여도 사실은 한 동작만 버티면 끝나. 나머지는 같이 하는 거야.',
            '무게보다 자세야. 자세가 무너지면 그날은 거기서 멈추는 게 맞아.'
          ],
          '헬스장 운영': [
            '회원이 줄어드는 건 시설 때문이 아니라 인사가 없어서인 경우가 많아.',
            '기구를 바꾸는 것보다 동선을 고치는 게 먼저라는 걸 세 지점 하면서 배웠어.',
            '새벽반은 사람이 적어도 꼭 열어 둬. 그 시간에만 오는 사람들이 있거든.',
            '청소는 티 안 나게 하는 게 제일 어려운 일이야.'
          ],
          '창업': [
            '지점 세 개를 혼자 돌리면서 제일 많이 한 일은 결국 확인이었어.',
            '매출이 오르는 달보다 인건비가 안 새는 달을 먼저 만들었어. 그게 오래 가.',
            '처음엔 다 잘 될 줄 알았어. 지금은 잘 될 때를 대비하는 법을 배워.',
            '직원을 뽑는 일은 결국 나를 복제하는 일이더라. 그게 제일 어려워.'
          ],
          '_': [
            '오늘 하나만 해두면 내일이 조금 가벼워져.',
            '시작이 반이라는 말은 시작한 사람만 하는 말이더라.',
            '꾸준함은 재능을 이겨. 진짜로.'
          ]
        },
        closers: [
          '궁금하면 그냥 와. 첫 수업은 같이 해.',
          '내일 오전 7시 수업, 자리 두 개 남았어.',
          '오늘 한 개만 해도 충분해. 내일 또 하면 되니까.'
        ]
      },
      pro: {
        hooks: [
          '크로스핏 박스 운영 4년, 지점 3곳을 유지하면서 남은 규칙이 하나 있어.',
          '운동을 시작할 때 먼저 볼 건 의지가 아니라 주당 방문 횟수야.',
          '지난 분기 지점별 재등록률을 정리해 봤어.',
          '회원 상담에서 제일 자주 나오는 질문은 "얼마나 걸리나요"야.',
          '운영 4년차에 들어서면서 수업 시간표를 다시 짰어.',
          '신규 회원의 첫 2주는 데이터로 보면 제일 위험한 구간이야.'
        ],
        middles: {
          '크로스핏': [
            '주 3회, 8주를 기준으로 잡으면 초보자도 자세가 안정되는 구간이 와.',
            '부상의 대부분은 무게가 아니라 피로 누적에서 나와. 수면과 식사가 먼저야.',
            'WOD는 매일 바뀌지만 강도 조절은 본인이 정할 수 있어야 해.',
            '가동 범위를 먼저 확보하면 중량은 따라와. 순서를 바꾸지 않는 게 핵심이야.'
          ],
          '헬스장 운영': [
            '재등록률을 올리는 변수는 시설보다 수업 시간표와 인사였어.',
            '지점 3곳을 같은 프로그램으로 운영하면 코치 교육 비용이 절반으로 줄어.',
            '신규 회원의 첫 2주 이탈률을 관리하는 게 매출 관리보다 효율적이야.',
            '운영 지표는 방문 빈도, 재등록률, 수업 정원 세 개면 충분해.'
          ],
          '창업': [
            '매출보다 먼저 봐야 할 숫자는 고정비 대비 인건비 비율이야.',
            '1인 운영에서 확장의 조건은 대표가 하지 않아도 돌아가는 절차야.',
            '지점을 늘리기 전에 표준 운영안을 문서로 남겨야 해.',
            '의사결정이 느린 조직은 대표가 모든 걸 확인할 때 생겨.'
          ],
          '_': [
            '반복되는 일은 절차로 만들고, 판단이 필요한 일만 남겨.',
            '측정할 수 없는 목표는 관리할 수 없어.',
            '작은 표본이라도 기록이 쌓이면 판단의 근거가 돼.'
          ]
        },
        closers: [
          '체험 수업은 예약제로 운영해.',
          '시간표는 고정해 두는 편이 좋아. 문의는 댓글로 받아.',
          '궁금한 건 댓글로 남겨 줘. 순서대로 답할게.'
        ]
      },
      humor: {
        hooks: [
          '오늘도 운동하러 왔다가, 운동한 척만 하고 갔어.',
          '버피 20개는 운동이 아니라 인생 상담이야.',
          '헬스장 사장이 제일 많이 하는 운동은 계산기 두드리기야.',
          '오늘 회원이 "선생님은 안 하세요?"라고 물었어. 좋은 질문이야.',
          '새벽 5시 50분 알람과의 싸움은 항상 져. 내가 져.',
          '운동 끝나고 계단 앞에서 3초간 인생을 고민해.'
        ],
        middles: {
          '크로스핏': [
            '크로스핏 첫날의 목표는 기록이 아니라, 다음 날 계단을 내려갈 수 있는지야.',
            '데드리프트 자세가 무너지면 무게가 아니라 자존심이 먼저 내려가.',
            '새벽 6시 수업은 사람이 아니라 의지력이 오는 시간이야.',
            '버피는 누구나 싫어해. 그런데 다들 와. 그게 크로스핏이야.'
          ],
          '헬스장 운영': [
            '회원권 만료 문자는 사랑 고백보다 타이밍이 중요해.',
            '기구 정리는 대표가 하면 그날만 되고, 시스템이 하면 1년을 가.',
            '새벽반 회원은 세 명인데, 그 세 명이 제일 무서워.',
            '헬스장에서 제일 무거운 건 바벨이 아니라 출근길 마음이야.'
          ],
          '창업': [
            '지점 세 개는 세 배의 매출이 아니라 세 배의 전화를 뜻해.',
            '창업은 로망이고, 운영은 알림톡이야.',
            '월급날의 표정은 대표와 직원이 달라.',
            '대표라는 직함은 청소부터 시작해.'
          ],
          '_': [
            '오늘 안 한 운동은 내일의 나한테 부탁하면 돼.',
            '계획은 완벽한데 실행이 안 되면, 그건 계획이 아니라 취향이야.',
            '꾸준히 하는 사람은 재능을 이겨. 재능은 그걸 몰라.'
          ]
        },
        closers: [
          '오늘 안 와도 괜찮아. 내일 오면 돼. 모레는 모르겠어.',
          '체험 신청은 댓글로. 거절은 안 해.',
          '운동은 배신하지 않아. 대신 다음 날 근육이 배신해.'
        ]
      },
      plain: {
        hooks: ['오늘 수업 기록.', '지점 세 곳을 운영하며 정리한 것.', '크로스핏 4년.', '오늘의 숫자.', '시간표를 바꿨어.', '문의가 많았던 것 하나.'],
        middles: {
          '크로스핏': [
            '잘하는 사람보다 꾸준히 오는 사람이 결국 이겨.',
            '무게는 숫자일 뿐이야. 자세가 남아.',
            '50분이면 충분해. 하루에 한 번이면 충분해.',
            '기록은 남겨. 6개월 뒤 그게 근거가 돼.'
          ],
          '헬스장 운영': [
            '시설은 돈으로 바뀌어. 인사는 습관으로 바뀌어.',
            '시간표가 흔들리면 회원도 흔들려.',
            '작은 지점도 기준은 같아야 해.',
            '회원 이름을 외우는 게 제일 싼 마케팅이야.'
          ],
          '창업': [
            '매출은 결과야. 절차가 원인이야.',
            '혼자 하는 일은 빨리 되지만, 오래 가지 않아.',
            '확장은 용기가 아니라 준비야.',
            '버티는 것도 전략이야.'
          ],
          '_': [
            '오늘 한 일을 적어 두면 다음 판단이 빨라져.',
            '작게 시작하고, 오래 가.',
            '기준이 있으면 흔들리지 않아.'
          ]
        },
        closers: ['체험은 1회 무료야.', '시간표는 고정이야. 문의는 댓글.', '오늘도 정상 운영.']
      }
    },
    formal: {
      friendly: {
        hooks: [
          '오늘 아침 수업, 끝나고 다들 바닥에 누워 있었어요. 저도요.',
          '회원님 한 분이 오늘 이런 말을 하더라고요.',
          '솔직히 저도 어제는 운동을 건너뛰었어요. 네, 맞아요.',
          '이번 주도 수업이 꽉 찼어요. 진심으로 감사합니다.',
          '3년 전 첫 회원님이 오늘 다시 오셨어요.',
          '오늘 처음 오신 분, 첫 동작에서 표정이 확 굳으시더라고요. 다 그래요.',
          '저녁 수업 끝나고 기구 정리하다가 문득 생각이 났어요.',
          '아침 6시 50분에 문 열면, 제일 먼저 오시는 분이 계세요.'
        ],
        middles: {
          '크로스핏': [
            '크로스핏은 잘하는 사람이 하는 게 아니라, 오늘 온 사람이 하는 거예요.',
            '처음 오시면 다들 데드리프트에서 눈이 풀려요. 저도 그랬고, 지금도 그렇습니다.',
            '50분이 길어 보여도 사실은 한 동작만 버티면 끝나요. 나머지는 같이 하는 거예요.',
            '무게보다 자세예요. 자세가 무너지면 그날은 거기서 멈추는 게 맞아요.'
          ],
          '헬스장 운영': [
            '회원이 줄어드는 건 시설 때문이 아니라 인사가 없어서인 경우가 많아요.',
            '기구를 바꾸는 것보다 동선을 고치는 게 먼저라는 걸 세 지점 하면서 배웠어요.',
            '새벽반은 사람이 적어도 꼭 열어 둬요. 그 시간에만 오는 분들이 있거든요.',
            '청소는 티 안 나게 하는 게 제일 어려운 일이에요.'
          ],
          '창업': [
            '지점 세 개를 혼자 돌리면서 제일 많이 한 일은 결국 확인이었어요.',
            '매출이 오르는 달보다 인건비가 안 새는 달을 먼저 만들었어요. 그게 오래 가요.',
            '처음엔 다 잘 될 줄 알았어요. 지금은 잘 될 때를 대비하는 법을 배워요.',
            '직원을 뽑는 일은 결국 나를 복제하는 일이더라고요. 그게 제일 어려워요.'
          ],
          '_': [
            '오늘 하나만 해두면 내일이 조금 가벼워져요.',
            '시작이 반이라는 말은 시작한 사람만 하는 말이더라고요.',
            '꾸준함은 재능을 이겨요. 진짜로요.'
          ]
        },
        closers: [
          '궁금하면 그냥 오세요. 첫 수업은 같이 해요.',
          '내일 오전 7시 수업, 자리 두 개 남았어요.',
          '오늘 한 개만 해도 충분해요. 내일 또 하면 되니까요.'
        ]
      },
      pro: {
        hooks: [
          '크로스핏 박스 운영 4년, 지점 3곳을 유지하면서 남은 규칙이 있습니다.',
          '운동을 시작할 때 먼저 볼 것은 의지가 아니라 주당 방문 횟수입니다.',
          '지난 분기 지점별 재등록률을 정리해 봤습니다.',
          '회원 상담에서 가장 자주 나오는 질문은 "얼마나 걸리나요"입니다.',
          '운영 4년차에 접어들며 수업 시간표를 다시 짰습니다.',
          '신규 회원의 첫 2주는 데이터로 보면 가장 위험한 구간입니다.'
        ],
        middles: {
          '크로스핏': [
            '주 3회, 8주를 기준으로 잡으면 초보자도 자세가 안정되는 구간이 옵니다.',
            '부상의 대부분은 무게가 아니라 피로 누적에서 나옵니다. 수면과 식사가 먼저입니다.',
            'WOD는 매일 바뀌지만 강도 조절은 본인이 정할 수 있어야 합니다.',
            '가동 범위를 먼저 확보하면 중량은 따라옵니다. 순서를 바꾸지 않는 것이 핵심입니다.'
          ],
          '헬스장 운영': [
            '재등록률을 올리는 변수는 시설보다 수업 시간표와 인사였습니다.',
            '지점 3곳을 같은 프로그램으로 운영하면 코치 교육 비용이 절반으로 줄어듭니다.',
            '신규 회원의 첫 2주 이탈률을 관리하는 것이 매출 관리보다 효율적입니다.',
            '운영 지표는 방문 빈도, 재등록률, 수업 정원의 세 가지면 충분합니다.'
          ],
          '창업': [
            '매출보다 먼저 봐야 할 숫자는 고정비 대비 인건비 비율입니다.',
            '1인 운영에서 확장의 조건은 대표가 하지 않아도 돌아가는 절차입니다.',
            '지점을 늘리기 전에 표준 운영안을 문서로 남겨야 합니다.',
            '의사결정이 느린 조직은 대표가 모든 것을 확인할 때 생깁니다.'
          ],
          '_': [
            '반복되는 일은 절차로 만들고, 판단이 필요한 일만 남깁니다.',
            '측정할 수 없는 목표는 관리할 수 없습니다.',
            '작은 표본이라도 기록이 쌓이면 판단의 근거가 됩니다.'
          ]
        },
        closers: [
          '체험 수업은 예약제로 운영합니다.',
          '시간표는 고정해 두는 편이 좋습니다. 문의는 댓글로 받습니다.',
          '궁금한 점은 댓글로 남겨 주시면 순서대로 답변드립니다.'
        ]
      },
      humor: {
        hooks: [
          '오늘도 운동하러 왔다가, 운동한 척만 하고 갔습니다.',
          '버피 20개는 운동이 아니라 인생 상담입니다.',
          '헬스장 사장이 가장 많이 하는 운동은 계산기 두드리기입니다.',
          '오늘 회원님이 "선생님은 안 하세요?"라고 물으셨습니다. 좋은 질문입니다.',
          '새벽 5시 50분 알람과의 싸움은 항상 집니다. 제가 집니다.',
          '운동 끝나고 계단 앞에서 3초간 인생을 고민합니다.'
        ],
        middles: {
          '크로스핏': [
            '크로스핏 첫날의 목표는 기록이 아니라, 다음 날 계단을 내려갈 수 있는지입니다.',
            '데드리프트 자세가 무너지면 무게가 아니라 자존심이 먼저 내려갑니다.',
            '새벽 6시 수업은 사람이 아니라 의지력이 오는 시간입니다.',
            '버피는 누구나 싫어합니다. 그런데 다들 옵니다. 그게 크로스핏입니다.'
          ],
          '헬스장 운영': [
            '회원권 만료 문자는 사랑 고백보다 타이밍이 중요합니다.',
            '기구 정리는 대표가 하면 그날만 되고, 시스템이 하면 1년이 갑니다.',
            '새벽반 회원은 세 명인데, 그 세 명이 제일 무섭습니다.',
            '헬스장에서 제일 무거운 건 바벨이 아니라 출근길 마음입니다.'
          ],
          '창업': [
            '지점 세 개는 세 배의 매출이 아니라 세 배의 전화를 뜻합니다.',
            '창업은 로망이고, 운영은 알림톡입니다.',
            '월급날의 표정은 대표와 직원이 다릅니다.',
            '대표라는 직함은 청소부터 시작합니다.'
          ],
          '_': [
            '오늘 안 한 운동은 내일의 나에게 부탁하면 됩니다.',
            '계획은 완벽한데 실행이 안 되면, 그건 계획이 아니라 취향입니다.',
            '꾸준히 하는 사람은 재능을 이깁니다. 재능은 그걸 모릅니다.'
          ]
        },
        closers: [
          '오늘 안 와도 괜찮습니다. 내일 오면 됩니다. 모레는 모르겠습니다.',
          '체험 신청은 댓글로. 거절은 안 합니다.',
          '운동은 배신하지 않습니다. 대신 다음 날 근육이 배신합니다.'
        ]
      },
      plain: {
        hooks: ['오늘 수업 기록.', '지점 세 곳을 운영하며 정리한 것.', '크로스핏 4년.', '오늘의 숫자.', '시간표를 바꿨습니다.', '문의가 많았던 것 하나.'],
        middles: {
          '크로스핏': [
            '잘하는 사람보다 꾸준히 오는 사람이 결국 이깁니다.',
            '무게는 숫자일 뿐입니다. 자세가 남습니다.',
            '50분이면 충분합니다. 하루에 한 번이면 충분합니다.',
            '기록은 남기세요. 6개월 뒤 그게 근거가 됩니다.'
          ],
          '헬스장 운영': [
            '시설은 돈으로 바뀝니다. 인사는 습관으로 바뀝니다.',
            '시간표가 흔들리면 회원도 흔들립니다.',
            '작은 지점도 기준은 같아야 합니다.',
            '회원 이름을 외우는 것이 가장 싼 마케팅입니다.'
          ],
          '창업': [
            '매출은 결과입니다. 절차가 원인입니다.',
            '혼자 하는 일은 빨리 되지만, 오래 가지 않습니다.',
            '확장은 용기가 아니라 준비입니다.',
            '버티는 것도 전략입니다.'
          ],
          '_': [
            '오늘 한 일을 적어 두면 다음 판단이 빨라집니다.',
            '작게 시작하고, 오래 갑니다.',
            '기준이 있으면 흔들리지 않습니다.'
          ]
        },
        closers: ['체험은 1회 무료입니다.', '시간표는 고정입니다. 문의는 댓글.', '오늘도 정상 운영.']
      }
    }
  };

  /* 댓글 자동 답글도 같은 두 벌 구조(말투 × 톤) */
  const REPLY_BANK = {
    casual: {
      friendly: {
        price: '안녕! 체험 수업은 1회 무료야. 회원권은 시간표 보고 편한 걸로 고르면 돼 🙂 궁금한 건 편하게 물어봐!',
        place: '라스트원 트레이닝은 양주 고읍점이야. 주차는 건물 뒤쪽에 3대 돼! 찾기 어려우면 DM 줘.',
        praise: '고마워! 그 한마디가 코치한테도 큰 힘이야 🙂 내일도 같은 시간에 봐.',
        first: '당연하지. 처음 오면 코치가 동작 하나씩 같이 봐 줄 거야. 운동화만 챙겨 와!'
      },
      pro: {
        price: '체험 수업은 1회 무료로 운영해. 정규 회원권은 주 2회·주 3회로 나뉘고, 금액은 프로필 링크 안내를 봐 줘.',
        place: '경기 양주시 고읍권에 있고, 건물 뒤편 주차 3대가 가능해. 대중교통으로 오면 도보 5분이야.',
        praise: '고마워. 수업 만족도 피드백은 프로그램 조정에 반영하고 있어.',
        first: '처음이면 체험 수업을 권해. 50분 수업에 코치가 동작을 개별로 확인해.'
      },
      humor: {
        price: '가격은 상담 때 알려줄게. 대신 확실한 건, 계단이 무서워진다는 거야.',
        place: '위치는 양주 고읍. 주차는 되는데 나올 때만 조심해.',
        praise: '칭찬 고마워. 그 말 들으려고 오늘 계단 세 번 올라갔어.',
        first: '처음이어도 돼. 첫날 목표는 기록이 아니라 귀가야.'
      },
      plain: {
        price: '체험 1회 무료야. 회원권 금액은 프로필 링크에 정리해 뒀어.',
        place: '경기 양주 고읍점이야. 주차 3대 가능해.',
        praise: '고마워. 내일도 같은 시간에 봐.',
        first: '첫 방문은 운동화만 있으면 돼. 50분 수업이야.'
      }
    },
    formal: {
      friendly: {
        price: '안녕하세요! 체험 수업은 1회 무료예요. 회원권은 시간표 보고 편한 걸로 고르시면 됩니다 🙂 궁금한 건 편하게 물어보세요!',
        place: '라스트원 트레이닝은 양주 고읍점이에요. 주차는 건물 뒤쪽에 3대 됩니다! 찾기 어려우시면 DM 주세요.',
        praise: '감사합니다! 그 한마디가 코치한테도 큰 힘이에요 🙂 내일도 같은 시간에 봬요.',
        first: '당연하죠. 처음 오시면 코치가 동작 하나씩 같이 봐 드려요. 운동화만 챙겨 오세요!'
      },
      pro: {
        price: '체험 수업은 1회 무료로 운영합니다. 정규 회원권은 주 2회·주 3회로 나뉘며, 금액은 프로필 링크의 안내를 참고해 주세요.',
        place: '경기 양주시 고읍권에 위치하며, 건물 뒤편 주차 3대가 가능합니다. 대중교통 이용 시 도보 5분입니다.',
        praise: '감사합니다. 수업 만족도 피드백은 프로그램 조정에 반영하고 있습니다.',
        first: '처음이시면 체험 수업을 권합니다. 50분 수업에 코치가 동작을 개별 확인합니다.'
      },
      humor: {
        price: '가격은 상담 때 알려드립니다. 대신 확실한 건, 계단이 무서워집니다.',
        place: '위치는 양주 고읍. 주차는 되는데 나오실 때만 조심하세요.',
        praise: '칭찬 감사합니다. 그 말 들으려고 오늘 계단 세 번 올라갔습니다.',
        first: '처음이어도 됩니다. 첫날 목표는 기록이 아니라 귀가입니다.'
      },
      plain: {
        price: '체험 1회 무료입니다. 회원권 금액은 프로필 링크에 정리해 두었습니다.',
        place: '경기 양주 고읍점입니다. 주차 3대 가능합니다.',
        praise: '감사합니다. 내일도 같은 시간에 뵙겠습니다.',
        first: '첫 방문은 운동화만 있으면 됩니다. 50분 수업입니다.'
      }
    }
  };

  const SAMPLE_COMMENTS = [
    { id: 'c1', who: '@fitminji', initial: 'F', text: '가격이 어떻게 되나요?', intent: 'price', at: '21:04' },
    { id: 'c2', who: '@jy_cross', initial: 'J', text: '위치가 어디예요? 주차도 되나요?', intent: 'place', at: '20:41' },
    { id: 'c3', who: '@hyun_gym', initial: 'H', text: '오늘 수업 너무 좋았어요 👍', intent: 'praise', at: '19:52' }
  ];

  const PLANS = {
    trial: {
      id: 'trial', name: '무료 체험', price: 0, accounts: 1,
      desc: '14일 동안 모든 기능',
      feats: ['계정 1개', '14일 무료', '모든 기능 사용', '카드 등록 없음']
    },
    standard: {
      id: 'standard', name: '스탠다드', price: 49000, accounts: 1,
      desc: '1인 운영에 필요한 것 전부',
      feats: ['계정 1개', '매일 최대 3회 자동 발행', 'AI 초안 무제한', '댓글 자동 답글', '주간 리포트']
    },
    pro: {
      id: 'pro', name: '프로', price: 99000, accounts: 3, badge: '추천',
      desc: '지점·브랜드를 함께 운영할 때',
      feats: ['계정 3개', '매일 최대 5회 · 계정별 시간대', 'AI 초안 무제한', '댓글 자동 답글 + FAQ', '인사이트 대시보드', '우선 지원']
    },
    agency: {
      id: 'agency', name: '에이전시', price: 290000, accounts: 10,
      desc: '고객사 계정을 대신 관리할 때',
      feats: ['계정 10개', '고객별 워크스페이스', '브랜드 보이스 프리셋', '발행 승인 옵션', '전담 온보딩']
    }
  };

  /* ---------------------------------------------------------------- 상태 */
  function defaultState() {
    return {
      v: 1,
      onboarded: false,
      accounts: [],
      active: null,
      settings: {
        topics: ['크로스핏', '헬스장 운영', '창업'],
        tone: 'friendly',
        formality: 'casual',   // 'casual' 반말 | 'formal' 존댓말 — 초안·답글 공통
        banned: ['최고', '무조건'],
        perDay: 3,
        slots: ['08:00', '12:30', '19:00'],
        autoPublish: true,
        replies: { enabled: true, tone: 'friendly', delay: '5분' }
      },
      drafts: [],
      queue: [],
      logs: [],
      sentReplies: [],
      plan: 'trial',
      seenLog: 0,
      seq: {},
      owner: null,            // 이 데이터의 주인(로그인 사용자 id)
      trialStartedAt: null,   // 회원가입 시 무료 체험 D-14 시작
      createdAt: Date.now()
    };
  }

  let state = defaultState();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state = Object.assign(defaultState(), saved);
      state.settings = Object.assign(defaultState().settings, saved.settings || {});
      state.settings.replies = Object.assign(defaultState().settings.replies, (saved.settings || {}).replies || {});
    } catch (e) {
      state = defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------- 인증(데모)
     실제 인증 서버가 없습니다. 계정과 세션은 이 브라우저의 localStorage에만
     남고, 비밀번호는 평문 대신 salt + SHA-256 해시로만 저장합니다.
     실서비스에서는 bcrypt/argon2 해시 + 이메일 인증 + OAuth + 서버 세션 토큰이
     필요합니다(PLAN.md 7.10).
  ------------------------------------------------------------------------ */
  const AUTH_KEY = 'threadpilot.auth.v1';
  let auth = { users: [], session: null };

  function loadAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      auth.users = Array.isArray(p.users) ? p.users : [];
      auth.session = p.session || null;
    } catch (e) {
      auth = { users: [], session: null };
    }
  }
  function saveAuth() {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) { /* ignore */ }
  }
  const isLoggedIn = () => !!(auth.session && auth.session.userId);
  const sessionUser = () => auth.users.find(u => u.id === (auth.session && auth.session.userId)) || null;

  function randomSalt() {
    const b = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function fallbackHash(str) {
    // crypto.subtle을 쓸 수 없는 환경(file:// 등)용 대체 해시 (FNV-1a 32bit ×2)
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = ((h1 ^ c) * 16777619) >>> 0;
      h2 = ((h2 + c) * 2654435761) >>> 0;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }
  async function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest && window.TextEncoder) {
      try {
        const buf = new window.TextEncoder().encode(str);
        const dig = await window.crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* fall through */ }
    }
    return fallbackHash(str);
  }
  async function hashPassword(pw, salt) {
    return 'sha256-' + await sha256Hex(salt + '::' + pw + '::threadpilot');
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function authMsg(msg) {
    const el = $('#auth-err');
    if (!el) { toast(msg); return; }
    el.textContent = msg;
    el.classList.toggle('show', !!msg);
  }
  function authBusy(busy, label) {
    const btn = $('#auth-submit');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? (label || '처리 중…') : (btn.dataset.label || '로그인');
  }
  function trialLeftDays() {
    const start = state.trialStartedAt || state.createdAt || Date.now();
    return Math.max(0, 14 - Math.floor((Date.now() - start) / DAY));
  }

  function adoptUser(user) {
    if (state.owner && state.owner !== user.id) state = defaultState();
    state.owner = user.id;
    if (!state.trialStartedAt) state.trialStartedAt = user.trialStartedAt || Date.now();
    if (!state.createdAt) state.createdAt = state.trialStartedAt;
  }

  function startSession(user, message) {
    auth.session = { userId: user.id, email: user.email, name: user.name, at: Date.now() };
    saveAuth();
    adoptUser(user);
    save();
    closeSheet(true);
    go(state.onboarded ? 'home' : 'connect');
    render();
    if (message) toast(message, user.name + ' · ' + user.email, 'ok');
  }

  async function doSignup() {
    const email = ($('#signup-email') || {}).value || '';
    const pw = ($('#signup-pass') || {}).value || '';
    const pw2 = ($('#signup-pass2') || {}).value || '';
    const name = ($('#signup-name') || {}).value || '';
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return authMsg('이메일 주소 형식을 확인해 주세요.');
    if (pw.length < 8) return authMsg('비밀번호는 8자 이상으로 정해 주세요.');
    if (pw !== pw2) return authMsg('비밀번호가 서로 달라요.');
    if (!name.trim()) return authMsg('이름을 입력해 주세요.');
    if (auth.users.some(u => u.email === em)) return authMsg('이미 가입된 이메일이에요. 로그인해 주세요.');
    authMsg('');
    authBusy(true, '가입 중…');
    const salt = randomSalt();
    const user = {
      id: uid('u'), email: em, name: name.trim(), salt: salt,
      hash: await hashPassword(pw, salt),
      createdAt: Date.now(), trialStartedAt: Date.now()
    };
    auth.users.push(user);
    state.trialStartedAt = user.trialStartedAt;
    saveAuth();
    startSession(user, '가입 완료 · 무료 체험 14일 시작');
  }

  async function doLogin() {
    const em = ((($('#login-email') || {}).value) || '').trim().toLowerCase();
    const pw = (($('#login-pass') || {}).value) || '';
    if (!EMAIL_RE.test(em)) return authMsg('이메일 주소 형식을 확인해 주세요.');
    if (!pw) return authMsg('비밀번호를 입력해 주세요.');
    const user = auth.users.find(u => u.email === em);
    if (!user) return authMsg('등록된 계정이 없어요. 회원가입으로 시작해 주세요.');
    authMsg('');
    authBusy(true, '로그인 중…');
    const hash = await hashPassword(pw, user.salt);
    if (hash !== user.hash) { authBusy(false); return authMsg('비밀번호가 맞지 않아요.'); }
    startSession(user, '다시 오신 걸 환영해요');
  }

  function doLogout() {
    auth.session = null;
    saveAuth();
    closeSheet(true);
    logFilter = 'all';
    location.hash = '#/login';
    render();
    toast('로그아웃했어요', '다시 로그인하면 설정이 그대로 이어져요');
  }

  function socialLogin(provider) {
    const meta = { kakao: ['카카오', 'kakao.demo@threadpilot.app'], google: ['구글', 'google.demo@threadpilot.app'], apple: ['Apple', 'apple.demo@threadpilot.app'] }[provider] || ['소셜', 'demo@threadpilot.app'];
    openSheet('<h3>' + meta[0] + ' 로그인 (데모)</h3>' +
      '<p class="sh-sub">실제 서비스에서는 ' + meta[0] + ' OAuth 창이 열리고 인증이 끝나면 이 앱으로 돌아옵니다. 지금은 데모라 그 과정을 건너뛰고 테스트 계정으로 들어갑니다.</p>' +
      '<div class="sheet-body"><p class="fine" style="margin-top:14px">테스트 계정 · ' + meta[1] + '</p></div>' +
      '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
      '<button class="btn primary" data-act="social-continue" data-p="' + provider + '">데모로 계속</button></div>');
  }

  function socialContinue(provider) {
    const meta = { kakao: ['카카오', 'kakao.demo@threadpilot.app'], google: ['구글', 'google.demo@threadpilot.app'], apple: ['Apple', 'apple.demo@threadpilot.app'] }[provider] || ['소셜', 'demo@threadpilot.app'];
    let user = auth.users.find(u => u.email === meta[1]);
    if (!user) {
      user = { id: uid('u'), email: meta[1], name: '한동엽', salt: randomSalt(), hash: '', provider: provider, createdAt: Date.now(), trialStartedAt: Date.now() };
      auth.users.push(user);
      saveAuth();
    }
    startSession(user, meta[0] + ' 데모 계정으로 로그인');
  }

  /* ---------------------------------------------------------------- 유틸 */
  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dayStart = d => { const x = new Date(d == null ? Date.now() : d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const atOn = (dayDate, hm) => { const parts = hm.split(':').map(Number); const d = new Date(dayDate); d.setHours(parts[0], parts[1], 0, 0); return d.getTime(); };
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const startOfWeek = off => { const d = new Date(); d.setHours(0, 0, 0, 0); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k + (off || 0) * 7); return d.getTime(); };
  const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const relDay = ms => {
    const diff = Math.round((dayStart(ms) - dayStart()) / DAY);
    if (diff === 0) return '오늘';
    if (diff === 1) return '내일';
    if (diff === -1) return '어제';
    const d = new Date(ms);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  };
  const untilText = ms => {
    const d = ms - Date.now();
    if (d <= 0) return '곧';
    const m = Math.round(d / MIN);
    if (m < 60) return m + '분 후';
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return (r ? h + '시간 ' + r + '분' : h + '시간') + ' 후';
    return Math.floor(h / 24) + '일 후';
  };
  const won = n => n.toLocaleString('ko-KR');
  const toLocalInput = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  function excerpt(t, n) {
    const first = String(t || '').split('\n')[0].replace(/\s+/g, ' ').trim();
    const len = n || 22;
    return first.length > len ? first.slice(0, len) + '…' : first;
  }
  function plainText(t) {
    return String(t || '').split('\n\n').filter(p => !/^#/.test(p.trim())).join(' ').trim();
  }
  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

  const activeAccount = () => state.accounts.find(a => a.id === state.active) || state.accounts[0] || null;
  const accountById = id => state.accounts.find(a => a.id === id) || null;

  /* ---------------------------------------------------------------- 아이콘 */
  const PATHS = {
    home: '<path d="M4 10.4 12 4l8 6.4V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z"/><path d="M9.4 20.4v-5.2h5.2v5.2"/>',
    spark: '<path d="M11.4 3.8 13 9.2l5.4 1.6-5.4 1.6-1.6 5.4-1.6-5.4L4.4 10.8 9.8 9.2z"/><path d="M18.4 15.4l.55 1.85 1.85.55-1.85.55-.55 1.85-.55-1.85-1.85-.55 1.85-.55z"/>',
    calendar: '<rect x="3.6" y="5.2" width="16.8" height="15.2" rx="3"/><path d="M8.2 3.4v3.4M15.8 3.4v3.4M3.6 10.2h16.8"/>',
    list: '<path d="M9 6.4h11M9 12h11M9 17.6h11"/><circle cx="4.9" cy="6.4" r="1.15"/><circle cx="4.9" cy="12" r="1.15"/><circle cx="4.9" cy="17.6" r="1.15"/>',
    sliders: '<path d="M4 7.4h8.4M17.4 7.4H20M4 16.6h4.6M13.4 16.6H20"/><circle cx="15" cy="7.4" r="2.3"/><circle cx="11" cy="16.6" r="2.3"/>',
    bell: '<path d="M6.6 16.4V11a5.4 5.4 0 0 1 10.8 0v5.4l1.4 1.9H5.2z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>',
    plus: '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
    x: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
    check: '<path d="M5 12.6 9.6 17.2 19 7.6"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 1.9"/>',
    chat: '<path d="M20.2 12.3c0 3.5-3.7 6.3-8.2 6.3-1 0-2-.1-2.9-.4L4.2 20l1.3-3.4a6.2 6.2 0 0 1-1.7-4.3c0-3.5 3.7-6.3 8.2-6.3s8.2 2.8 8.2 6.3z"/>',
    refresh: '<path d="M19.2 12a7.2 7.2 0 1 1-2.1-5.1"/><path d="M20 4.6v4.6h-4.6"/>',
    left: '<path d="M14.5 6 8.5 12l6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    send: '<path d="M20.4 4.2 3.8 11.2l6.2 2.6 2.6 6.2z"/><path d="M10 13.8l4.4-4.4"/>',
    trash: '<path d="M5 7.2h14M9.6 7.2V5.4h4.8v1.8M7.2 7.2l.7 12a1.6 1.6 0 0 0 1.6 1.4h5a1.6 1.6 0 0 0 1.6-1.4l.7-12"/>',
    edit: '<path d="M4.4 19.6h4L19 9 15 5 4.4 15.6z"/><path d="M13.6 6.4l4 4"/>',
    play: '<path d="M8.4 5.6 18 12l-9.6 6.4z"/>',
    user: '<circle cx="12" cy="8.6" r="3.6"/><path d="M4.8 20c0-3.6 3.2-5.6 7.2-5.6s7.2 2 7.2 5.6"/>',
    bolt: '<path d="M13 3.4 5.8 13.4h5l-1 7.2 7.4-10.2h-5z"/>',
    card: '<rect x="3.4" y="5.6" width="17.2" height="12.8" rx="3"/><path d="M3.4 10.2h17.2"/>',
    shield: '<path d="M12 3.6 5.4 6.2v5.4c0 4 2.8 7.2 6.6 8.4 3.8-1.2 6.6-4.4 6.6-8.4V6.2z"/><path d="M9.4 11.9l1.9 1.9 3.4-3.6"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9v.2"/>',
    copy: '<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2.6"/><path d="M15.6 8.4V6.6a2 2 0 0 0-2-2H6.6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1.8"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="M15.9 15.9 20.2 20.2"/>'
  };
  function icon(name, size, sw) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.75) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }
  function markSvg(size) {
    return '<svg width="' + (size || 15) + '" height="' + (size || 15) + '" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M3.6 5.1h8.8M3.6 8h5.4M3.6 10.9h8.8"/></svg>';
  }
  // 붐비다 실제 로고 이미지 — 옆에 운영사 이름이 글자로 있으므로 장식으로 둡니다(alt 비움)
  function opLogo(size, cls) {
    const s = size || 15;
    return '<img class="op-logo' + (cls ? ' ' + cls : '') + '" src="' + OP_LOGO + '" alt="" width="' + s + '" height="' + s + '" decoding="async">';
  }

  /* ---------------------------------------------------------------- 생성 */
  function hitsBanned(text) {
    return (state.settings.banned || []).some(w => w && text.indexOf(w) !== -1);
  }
  function recentParts() {
    const recent = state.queue.slice(-6).map(q => q.text).concat(state.drafts.map(d => d.text));
    const hooks = [], mids = [];
    recent.forEach(t => {
      const parts = String(t).split('\n\n');
      if (parts[0]) hooks.push(parts[0]);
      if (parts[1]) mids.push(parts[1]);
    });
    return { hooks: hooks.slice(-5), mids: mids.slice(-3) };
  }
  const genBank = (tone, formality) => (GEN[formality] || GEN.casual)[tone] || (GEN[formality] || GEN.casual).friendly;

  function compose(topic, tone, formality) {
    const fem = formality || state.settings.formality || 'casual';
    const g = genBank(tone, fem);
    const mids = g.middles[topic] || g.middles._;
    const tags = (TAGS[topic] || TAGS._).join(' ');
    const prev = recentParts();
    state.seq = state.seq || {};
    const seqKey = tone + ':' + fem;
    const seq = state.seq[seqKey] || 0;
    let mid = pick(mids);
    for (let i = 0; i < 14 && prev.mids.indexOf(mid) !== -1; i++) mid = pick(mids);
    for (let k = 0; k < g.hooks.length; k++) {
      const h = g.hooks[(seq + k) % g.hooks.length];
      for (let i = 0; i < 10; i++) {
        const m = i === 0 ? mid : pick(mids);
        const text = h + '\n\n' + m + '\n\n' + pick(g.closers) + '\n\n' + tags;
        if (!hitsBanned(text) && !state.queue.some(q => q.text === text) && !state.drafts.some(d => d.text === text)) {
          state.seq[seqKey] = seq + k + 1;
          return text;
        }
      }
    }
    state.seq[seqKey] = seq + 1;
    return g.hooks[seq % g.hooks.length] + '\n\n' + mid + '\n\n' + pick(g.closers) + '\n\n' + tags;
  }
  function replyFor(intent, tone, formality) {
    const fem = (REPLY_BANK[formality || state.settings.formality]) ? (formality || state.settings.formality) : 'casual';
    const byTone = REPLY_BANK[fem] || REPLY_BANK.casual;
    const bank = byTone[tone] || byTone.friendly;
    return bank[intent] || bank.price;
  }

  /* ---------------------------------------------------------------- 로그 */
  function addLog(type, at, text, qid, auto) {
    state.logs.push({ id: uid('l'), type: type, at: at, text: text, qid: qid || null, auto: auto !== false });
    if (state.logs.length > 400) state.logs = state.logs.slice(-400);
  }

  /* ---------------------------------------------------------------- 데모 데이터 */
  function isSlotTaken(at) {
    return state.queue.some(q => Math.abs(q.at - at) < MIN);
  }

  function ensureFill(force) {
    const s = state.settings;
    if (!s.autoPublish && !force) return;
    const now = Date.now();
    const acct = state.active;
    for (let d = 0; d < 4; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      const day0 = day.getTime(), day1 = day0 + DAY;
      const dayItems = state.queue.filter(q => q.at >= day0 && q.at < day1);
      if (dayItems.length > 0 && !force) continue;
      s.slots.slice(0, s.perDay).forEach((hm, idx) => {
        const at = atOn(day, hm);
        if (at <= now + 3 * MIN) return;
        if (dayItems.some(q => Math.abs(q.at - at) < MIN)) return;
        const topic = s.topics[(d + idx) % Math.max(1, s.topics.length)] || '오늘';
        state.queue.push({
          id: uid('q'), acct: acct, text: compose(topic, s.tone), at: at,
          status: 'scheduled', topic: topic, tone: s.tone, formality: s.formality, auto: true
        });
      });
    }
  }

  function seedDemo() {
    const now = Date.now();
    const s = state.settings;
    // 지난 3일 + 오늘 지난 시간대: 발행 완료 기록
    for (let d = -3; d <= 0; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      s.slots.slice(0, s.perDay).forEach((hm, idx) => {
        const at = atOn(day, hm);
        if (at > now - 4 * MIN) return;
        if (isSlotTaken(at)) return;
        const topic = s.topics[idx % Math.max(1, s.topics.length)] || '오늘';
        state.queue.push({
          id: uid('q'), acct: state.active, text: compose(topic, s.tone), at: at,
          status: 'published', publishedAt: at, topic: topic, tone: s.tone, formality: s.formality, auto: true
        });
      });
    }
    state.queue.filter(q => q.status === 'published').sort((a, b) => a.at - b.at).forEach(q => {
      addLog('publish', q.publishedAt || q.at, "'" + excerpt(q.text) + "' 발행 완료", q.id);
    });
    addLog('reply', now - 4 * HOUR, '@fitminji 댓글에 자동 답글 전송', null);
    addLog('reply', now - 27 * HOUR, '@hyun_gym 댓글에 자동 답글 전송', null);
    addLog('system', now - 30 * HOUR, '라스트원 트레이닝 계정 연결 완료 · threads_basic, threads_content_publish', null);
    ensureFill(true);
    save();
  }

  /* ---------------------------------------------------------------- 발행 처리 */
  function processDue(silent) {
    const now = Date.now();
    const due = state.queue.filter(q => q.status === 'scheduled' && q.at <= now).sort((a, b) => a.at - b.at);
    if (!due.length) return 0;
    due.forEach(q => {
      q.status = 'published';
      q.publishedAt = q.at;
      addLog('publish', q.at, "'" + excerpt(q.text) + "' 발행 완료", q.id);
      if (!silent && now - q.at < 6 * HOUR) toast(hhmm(q.at) + ' 발행 완료', excerpt(q.text, 16));
    });
    save();
    return due.length;
  }

  function publishNow(id) {
    const q = state.queue.find(x => x.id === id);
    if (!q) return;
    q.status = 'published';
    q.publishedAt = Date.now();
    addLog('publish', Date.now(), "'" + excerpt(q.text) + "' 발행 완료", q.id, false);
    save();
    closeSheet(true);
    render();
    toast('발행 완료', excerpt(q.text, 14));
  }

  /* ---------------------------------------------------------------- 토스트 */
  function toast(text, sub, kind) {
    const root = $('#toast-root');
    if (!root) return;
    while (root.children.length >= 3) root.removeChild(root.firstChild);
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="ti ' + (kind === 'warn' ? 'warn' : kind === 'ok' ? 'ok' : '') + '">' + icon(kind === 'warn' ? 'info' : 'check', 13, 2.6) + '</span>' +
      '<span class="ttext">' + esc(text) + '</span>' + (sub ? '<span class="ts">' + esc(sub) + '</span>' : '');
    root.appendChild(el);
    void el.offsetWidth;
    el.classList.add('in');
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
  }

  /* ---------------------------------------------------------------- 시트 */
  function openSheet(html) {
    const root = $('#sheet-root');
    if (!root) return;
    root.innerHTML = '<button class="scrim" data-act="close-sheet" aria-label="닫기"></button>' +
      '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    const scrim = root.querySelector('.scrim');
    const sh = root.querySelector('.sheet');
    requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); });
  }
  function closeSheet(immediate) {
    const root = $('#sheet-root');
    if (!root || !root.firstChild) return;
    if (immediate) { root.innerHTML = ''; return; }
    const scrim = root.querySelector('.scrim');
    const sh = root.querySelector('.sheet');
    if (scrim) scrim.classList.remove('in');
    if (sh) sh.classList.remove('in');
    setTimeout(() => { root.innerHTML = ''; }, 300);
  }

  /* ---------------------------------------------------------------- 시트들 */
  let sheetPick = 0;
  let pendingDraft = null;
  let pendingSlot = null;

  function openConnectSheet() {
    sheetPick = 0;
    const scopes = [
      ['threads_basic', '프로필과 게시물 읽기'],
      ['threads_content_publish', '글 발행'],
      ['threads_read_replies', '댓글 읽기 (자동 답글)'],
      ['threads_manage_replies', '답글 작성']
    ];
    const body = '<h3>Threads 계정 연결</h3>' +
      '<p class="sh-sub">실제 서비스에서는 메타 로그인 창이 열리고 거기서 직접 로그인합니다. ThreadPilot은 비밀번호를 받지도, 저장하지도 않습니다.</p>' +
      '<div class="sheet-body">' +
        '<div class="help-line" style="margin-top:14px">' +
          '<span class="hl-ic">' + icon('info', 14) + '</span>' +
          '<div><p class="hl-t">스레드 비밀번호가 기억나지 않나요?</p>' +
          '<a class="ext-link" href="https://accountscenter.instagram.com/password_reset/" target="_blank" rel="noopener noreferrer">메타 계정 복구 페이지로 이동' + icon('right', 12) + '</a>' +
          '<p class="hl-d">메타 로그인 창에도 “비밀번호를 잊으셨나요?” 링크가 있습니다. 재설정은 메타(인스타그램) 사이트에서 본인 계정으로 하세요.</p></div>' +
        '</div>' +
        '<div class="sec-label">요청하는 권한</div>' +
        '<div class="set-card">' +
          scopes.map(s => '<div class="set-row static"><span class="ic" style="background:var(--accent-soft);color:var(--accent)">' + icon('check', 15, 2.2) + '</span>' +
            '<div><div class="lab" style="font-size:13px">' + s[1] + '</div><div class="desc">' + s[0] + '</div></div></div>').join('') +
        '</div>' +
        '<div class="sec-label">연결할 계정</div>' +
        '<div class="set-card">' +
          DEMO_ACCOUNTS.map((a, i) => '<button class="set-row" data-act="acct-pick" data-i="' + i + '" style="cursor:pointer">' +
            '<span class="avatar" style="background:' + a.color + ';width:34px;height:34px;font-size:13px">' + esc(a.name.slice(0, 1)) + '</span>' +
            '<div><div class="lab">' + esc(a.name) + '</div><div class="desc">' + esc(a.handle) + '</div></div>' +
            '<span class="val" data-pick="' + i + '">' + (i === 0 ? icon('check', 18, 2.2) : '') + '</span></button>').join('') +
        '</div>' +
        '<p class="fine" style="margin-top:12px">데모 모드 · 위 링크는 메타 사이트를 새 탭으로 열기만 하고, 실제 로그인 요청은 보내지 않습니다. 실제 스레드 계정에도 아무 것도 게시되지 않습니다.</p>' +
      '</div>' +
      '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
      '<button class="btn primary" data-act="connect-confirm">데모 계정으로 연결</button></div>';
    openSheet(body);
  }

  function connectConfirm() {
    const opt = DEMO_ACCOUNTS[sheetPick] || DEMO_ACCOUNTS[0];
    let acc = state.accounts.find(a => a.handle === opt.handle);
    const isNew = !acc;
    if (!acc) {
      acc = { id: uid('a'), handle: opt.handle, name: opt.name, color: opt.color, connectedAt: Date.now() };
      state.accounts.push(acc);
    }
    state.active = acc.id;
    const wasOnboarded = state.onboarded;
    state.onboarded = true;
    save();
    closeSheet(true);
    if (!wasOnboarded) {
      seedDemo();
      toast(acc.name + ' 계정 연결 완료', '이번 주 예약을 채워 두었어요', 'ok');
      go('home');
    } else {
      ensureFill(false);
      save();
      render();
      toast(isNew ? acc.name + ' 계정을 추가했어요' : '이미 연결된 계정이에요', isNew ? '대표 계정으로 설정했습니다' : acc.handle, 'ok');
    }
  }

  function openScheduleSheet(draftId) {
    const d = state.drafts.find(x => x.id === draftId);
    if (!d) return;
    pendingDraft = draftId;
    const slots = nextSlots(5);
    pendingSlot = slots.length ? slots[0] : (Date.now() + 10 * MIN);
    openSheet(
      '<h3>예약 발행</h3>' +
      '<p class="sh-sub">' + esc(relDay(pendingSlot)) + ' ' + hhmm(pendingSlot) + '에 ' + esc(activeAccount().name) + ' 계정으로 올라갑니다.</p>' +
      '<div class="sheet-body">' +
        '<div class="card flat" style="margin-top:14px"><p class="dtext" style="font-size:13px">' + esc(d.text) + '</p></div>' +
        '<div class="sec-label">발행 시각</div>' +
        (slots.length && (slots[0] - Date.now()) > 1.2 * DAY
          ? '<p class="fine" style="margin-bottom:8px">가까운 시간대는 이미 예약으로 배정되어 있어요. 가장 빠른 빈 시간을 골라 두었습니다.</p>'
          : '') +
        '<div class="chips" style="flex-direction:column;align-items:stretch;gap:6px" id="slot-list">' +
          slots.map((t, i) => '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-act="slot-pick" data-t="' + t + '" style="justify-content:space-between;height:44px;padding:0 14px">' +
            '<span>' + esc(relDay(t)) + ' ' + hhmm(t) + '</span><span class="small" style="font-weight:600">' + untilText(t) + '</span></button>').join('') +
        '</div>' +
        '<div class="sec-label">직접 입력</div>' +
        '<input type="datetime-local" class="input" id="custom-at" value="' + toLocalInput(pendingSlot) + '" />' +
      '</div>' +
      '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
      '<button class="btn primary" data-act="schedule-confirm">예약하기</button></div>'
    );
  }

  function nextSlots(n) {
    const s = state.settings;
    const out = [];
    for (let d = 0; d < 10 && out.length < n; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      const day0 = day.getTime(), day1 = day0 + DAY;
      const dayItems = state.queue.filter(q => q.at >= day0 && q.at < day1);
      if (dayItems.length >= s.perDay && out.length) continue;
      for (const hm of s.slots.slice(0, s.perDay)) {
        const at = atOn(day, hm);
        if (at <= Date.now() + 2 * MIN) continue;
        if (dayItems.some(q => Math.abs(q.at - at) < MIN)) continue;
        out.push(at);
        if (out.length >= n) break;
      }
    }
    return out;
  }

  function scheduleConfirm() {
    const d = state.drafts.find(x => x.id === pendingDraft);
    if (!d) { closeSheet(true); return; }
    const custom = $('#custom-at');
    let at = pendingSlot;
    if (custom && custom.value) {
      const t = new Date(custom.value).getTime();
      if (!isNaN(t)) at = t;
    }
    state.queue.push({
      id: uid('q'), acct: state.active, text: d.text, at: at,
      status: 'scheduled', topic: d.topic, tone: d.tone, formality: d.formality, auto: false
    });
    d.scheduledAt = at;
    addLog('system', Date.now(), "초안 예약 · " + relDay(at) + " " + hhmm(at) + " '" + excerpt(d.text, 16) + "'", null);
    save();
    closeSheet(true);
    render();
    toast(relDay(at) + ' ' + hhmm(at) + ' 예약 완료', excerpt(d.text, 14), 'ok');
  }

  function openItemSheet(id) {
    const q = state.queue.find(x => x.id === id);
    if (!q) return;
    const acc = accountById(q.acct);
    const isSched = q.status === 'scheduled';
    const meta = [];
    if (acc) meta.push(esc(acc.name));
    meta.push(esc(q.topic));
    meta.push(TONE_LABEL[q.tone] || '');
    meta.push(FORMALITY_LABEL[q.formality] || '');
    openSheet(
      '<h3>' + (isSched ? '예약 발행' : '발행 완료') + '</h3>' +
      '<p class="sh-sub">' + esc(relDay(q.at)) + ' ' + hhmm(q.at) + ' · ' + meta.join(' · ') + (q.auto ? ' · 자동 생성' : '') + '</p>' +
      '<div class="sheet-body">' +
        '<div class="card flat" style="margin-top:14px"><p class="dtext">' + esc(q.text) + '</p></div>' +
        '<div class="row" style="margin-top:12px"><span class="tag ' + (isSched ? 'accent' : 'ok') + '">' + (isSched ? '예약됨' : '발행 완료') + '</span>' +
        '<span class="small">' + (isSched ? untilText(q.at) + ' 발행' : (q.publishedAt ? hhmm(q.publishedAt) + ' 발행' : '')) + '</span></div>' +
        (isSched ? '<p class="fine" style="margin-top:10px">이 시각이 지나면 자동으로 발행되고 로그에 기록됩니다. (데모: 실제 게시 없음)</p>' : '') +
      '</div>' +
      '<div class="sheet-actions">' +
        (isSched
          ? '<button class="btn line" data-act="cancel-item" data-id="' + q.id + '">취소</button>' +
            '<button class="btn line" data-act="edit-item" data-id="' + q.id + '">수정</button>' +
            '<button class="btn primary" data-act="publish-now" data-id="' + q.id + '">' + icon('play', 14) + '지금 발행</button>'
          : '<button class="btn line" data-act="close-sheet">닫기</button>') +
      '</div>'
    );
  }

  function openEditSheet(id) {
    const q = state.queue.find(x => x.id === id);
    if (!q) return;
    openSheet(
      '<h3>예약 수정</h3>' +
      '<p class="sh-sub">문구와 발행 시각을 바꿀 수 있어요.</p>' +
      '<div class="sheet-body">' +
        '<textarea class="input" id="edit-text" rows="6" style="margin-top:14px">' + esc(q.text) + '</textarea>' +
        '<div class="row" style="margin-top:8px"><span class="small" id="edit-len">' + q.text.length + '자 / 500자</span></div>' +
        '<div class="sec-label">발행 시각</div>' +
        '<input type="datetime-local" class="input" id="edit-at" value="' + toLocalInput(q.at) + '" />' +
      '</div>' +
      '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
      '<button class="btn primary" data-act="save-edit" data-id="' + q.id + '">저장</button></div>'
    );
    const ta = $('#edit-text');
    const lenEl = $('#edit-len');
    if (ta && lenEl) ta.addEventListener('input', () => { lenEl.textContent = ta.value.length + '자 / 500자'; });
  }

  function saveEdit(id) {
    const q = state.queue.find(x => x.id === id);
    if (!q) return;
    const ta = $('#edit-text'), at = $('#edit-at');
    if (ta && ta.value.trim()) q.text = ta.value.trim().slice(0, 500);
    if (at && at.value) {
      const t = new Date(at.value).getTime();
      if (!isNaN(t)) q.at = t;
    }
    addLog('system', Date.now(), "예약 수정 · '" + excerpt(q.text, 16) + "'", q.id);
    save();
    closeSheet(true);
    render();
    toast('예약을 수정했어요', relDay(q.at) + ' ' + hhmm(q.at));
  }

  function cancelItem(id) {
    const q = state.queue.find(x => x.id === id);
    if (!q) return;
    q.status = 'canceled';
    addLog('system', Date.now(), "예약 취소 · '" + excerpt(q.text, 16) + "'", null);
    save();
    closeSheet(true);
    render();
    toast('예약을 취소했어요', excerpt(q.text, 14));
  }

  /* ---------------------------------------------------------------- 뷰: 로그인/회원가입 */
  const SOCIALS = [
    { id: 'kakao', label: '카카오로 계속하기', bg: '#FEE500', fg: '#3C1E1E', ch: '카' },
    { id: 'google', label: '구글로 계속하기', bg: '#FFFFFF', fg: '#4285F4', ch: 'G' },
    { id: 'apple', label: 'Apple로 계속하기', bg: '#111114', fg: '#FFFFFF', ch: 'A' }
  ];

  function authSocials() {
    return '<div class="socials">' + SOCIALS.map(s =>
      '<button type="button" class="soc-row" data-act="social" data-p="' + s.id + '">' +
        '<span class="soc-dot" style="background:' + s.bg + ';color:' + s.fg + '">' + s.ch + '</span>' +
        '<span class="soc-lab">' + s.label + '</span>' +
        '<span class="tag">데모</span></button>').join('') + '</div>';
  }

  // 편집: 로그인·회원가입 상단 워드마크 아래 운영사 표기
  function authByline() {
    return '<p class="auth-by">' + opLogo(15) + '<span class="by-k">by</span><b>' + OPERATOR.ko + '</b><span class="by-en">' + OPERATOR.en + '</span></p>';
  }

  function authFooterNote() {
    return '<div class="auth-foot">' +
      '<p class="auth-note">' + icon('shield', 12) + '데모 · 실제 인증 서버 없음, 입력한 정보는 이 기기 브라우저에만 저장됩니다</p>' +
      '<p class="auth-op">' + OP_LINE + '</p>' +
    '</div>';
  }

  // 편집: 설정·요금제 화면 하단 운영사 푸터
  function operatorFooter() {
    return '<div class="op-sign">' +
      opLogo(20, 'os-logo') +
      '<span class="os-t">ThreadPilot ' + esc(OP_LINE) + '</span>' +
    '</div>';
  }

  function viewLogin() {
    return '<div class="auth">' +
      '<div class="auth-head">' +
        '<div class="mark-lg">' + markSvg(26) + '</div>' +
        '<h1>ThreadPilot</h1>' +
        authByline() +
        '<p class="auth-copy">스레드는 알아서 돌아갑니다.<br>내 계정 설정은 로그인한 계정에 그대로 남아요.</p>' +
      '</div>' +
      '<form class="auth-form" id="login-form" novalidate>' +
        '<label class="fl" for="login-email">이메일</label>' +
        '<input class="input" id="login-email" type="email" inputmode="email" autocomplete="username" placeholder="you@example.com" />' +
        '<label class="fl" for="login-pass">비밀번호</label>' +
        '<input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="8자 이상" />' +
        '<p class="auth-err" id="auth-err" role="alert"></p>' +
        '<button class="btn primary block" id="auth-submit" type="submit" data-label="로그인">로그인</button>' +
        '<div class="auth-links">' +
          '<button type="button" class="link-btn" data-act="reset-pw">ThreadPilot 비밀번호 찾기</button>' +
          '<button type="button" class="link-btn strong" data-act="nav" data-to="signup">회원가입</button>' +
        '</div>' +
      '</form>' +
      '<div class="divider"><span>또는</span></div>' +
      authSocials() +
      authFooterNote() +
    '</div>';
  }

  function viewSignup() {
    return '<div class="auth">' +
      '<div class="auth-head">' +
        '<div class="mark-lg">' + markSvg(26) + '</div>' +
        '<h1>14일 무료로 시작</h1>' +
        authByline() +
        '<p class="auth-copy">카드 등록 없이 모든 기능을 써 볼 수 있어요.<br>가입하면 계정 정보와 설정이 이 기기에 저장됩니다.</p>' +
      '</div>' +
      '<form class="auth-form" id="signup-form" novalidate>' +
        '<label class="fl" for="signup-name">이름</label>' +
        '<input class="input" id="signup-name" autocomplete="name" maxlength="20" placeholder="한동엽" />' +
        '<label class="fl" for="signup-email">이메일</label>' +
        '<input class="input" id="signup-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />' +
        '<label class="fl" for="signup-pass">비밀번호</label>' +
        '<input class="input" id="signup-pass" type="password" autocomplete="new-password" placeholder="8자 이상" />' +
        '<label class="fl" for="signup-pass2">비밀번호 확인</label>' +
        '<input class="input" id="signup-pass2" type="password" autocomplete="new-password" placeholder="한 번 더 입력" />' +
        '<p class="auth-err" id="auth-err" role="alert"></p>' +
        '<button class="btn primary block" id="auth-submit" type="submit" data-label="무료 체험 시작하기">무료 체험 시작하기</button>' +
        '<div class="auth-links">' +
          '<button type="button" class="link-btn strong" data-act="nav" data-to="login">이미 계정이 있어요 · 로그인</button>' +
        '</div>' +
      '</form>' +
      '<div class="trial-note"><span class="tag accent">D-14</span><p>가입하는 순간부터 무료 체험 14일이 시작됩니다. 끝나기 전에 알려드릴게요.</p></div>' +
      '<div class="divider"><span>또는</span></div>' +
      authSocials() +
      authFooterNote() +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 연결 */
  function viewConnect() {
    const acc = activeAccount();
    return '<div class="onboard">' +
      '<div class="mark-lg">' + markSvg(26) + '</div>' +
      '<p class="onboard-kicker">' + opLogo(13) + '<span>ThreadPilot · ' + OPERATOR.studio + '</span></p>' +
      '<h1>스레드는 알아서<br>돌아갑니다</h1>' +
      '<p class="lead">주제와 말투만 정해두면 정한 시간에 글이 올라가고,<br>댓글에는 같은 톤으로 답글이 달립니다.</p>' +
      '<div class="queue-card">' +
        '<div class="qc-head"><span>오늘의 예약</span><span class="qc-badge">3건</span></div>' +
        '<div class="qc-row"><span class="qc-time">08:00</span><span class="qc-text">오늘 아침 수업, 끝나고 다들 바닥에…</span><span class="qc-state">발행됨</span></div>' +
        '<div class="qc-row"><span class="qc-time">12:30</span><span class="qc-text">크로스핏은 잘하는 사람이 하는 게 아니라…</span><span class="qc-state">발행됨</span></div>' +
        '<div class="qc-row"><span class="qc-time">19:00</span><span class="qc-text">무게보다 자세야. 자세가 무너지면…</span><span class="qc-state wait">대기</span></div>' +
        '<div class="qc-foot">' + icon('check', 12, 2.4) + '댓글 3건에 자동 답글까지 — 손 안 대고 끝났습니다</div>' +
      '</div>' +
      '<button class="btn primary block" data-act="connect-open">스레드로 계속하기</button>' +
      '<p class="fine" style="text-align:center;margin-top:10px">지금은 데모 계정으로 연결됩니다 · 실제 서비스에서는 메타(Threads) 로그인 창이 열립니다</p>' +

      '<div class="help-line">' +
        '<span class="hl-ic">' + icon('info', 14) + '</span>' +
        '<div><p class="hl-t">스레드 비밀번호를 모르시나요?</p>' +
        '<a class="ext-link" href="https://accountscenter.instagram.com/password_reset/" target="_blank" rel="noopener noreferrer">메타 계정 복구 페이지로 이동' + icon('right', 12) + '</a>' +
        '<p class="hl-d">메타(인스타그램) 사이트가 새 탭으로 열립니다. 우리가 비밀번호를 받는 화면이 아니에요.</p></div>' +
      '</div>' +

      '<div class="foot">' +
        '<div class="flow-head">연결은 이렇게 진행돼요</div>' +
        '<ul class="steps">' +
          '<li><span class="n done">' + icon('check', 11, 2.6) + '</span><div><b>우리 서비스 가입</b> — 완료</div></li>' +
          '<li><span class="n">2</span><div><b>스레드 계정 권한 승인</b> — 메타 로그인 창에서 직접 로그인합니다. 우리는 비밀번호를 받지 않습니다</div></li>' +
          '<li><span class="n">3</span><div><b>주제 · 말투 설정</b> — 하루 발행 횟수와 시간대</div></li>' +
          '<li><span class="n">4</span><div><b>자동 발행</b> — 초안 승인 없이 알아서, 알림만</div></li>' +
        '</ul>' +
        (acc ? '<p class="small" style="margin-top:16px">이미 연결된 계정: ' + esc(acc.name) + ' ' + esc(acc.handle) + '</p>' : '') +
        '<div class="connect-sign">' +
          '<p class="cs-line">' + opLogo(13) + '<span>Powered by <b>' + OPERATOR.ko + '</b></span><span class="cs-en">' + OPERATOR.en + '</span></p>' +
          '<p class="cs-sub">© 2026 ThreadPilot · ' + OPERATOR.studio + ' · 데모 프로토타입</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 홈 */
  function statBox(v, unit, k) {
    return '<div class="stat"><div class="v">' + v + '<span>' + unit + '</span></div><div class="k">' + k + '</div></div>';
  }

  function viewHome() {
    const acc = activeAccount();
    if (!acc) return viewConnect();
    const today0 = dayStart(), today1 = today0 + DAY;
    const todays = state.queue.filter(q => q.at >= today0 && q.at < today1 && q.status !== 'canceled').sort((a, b) => a.at - b.at);
    const doneToday = todays.filter(q => q.status === 'published').length;
    const next = state.queue.filter(q => q.status === 'scheduled').sort((a, b) => a.at - b.at)[0];
    const week0 = startOfWeek(0), week1 = week0 + 7 * DAY;
    const weekItems = state.queue.filter(q => q.at >= week0 && q.at < week1 && q.status !== 'canceled');
    const weekSched = weekItems.filter(q => q.status === 'scheduled').length;
    const weekDone = weekItems.filter(q => q.status === 'published').length;
    const weekRep = state.logs.filter(l => l.type === 'reply' && l.at >= week0).length;
    const saved = weekDone * 7 + weekRep * 2;
    const pct = todays.length ? Math.round((doneToday / todays.length) * 100) : 0;
    const ring = 58, r = 25, c = 2 * Math.PI * r;
    const recent = state.logs.slice().sort((a, b) => b.at - a.at).slice(0, 3);

    return '<div class="page">' +
      '<h1>' + esc(acc.name) + '<span class="sub">' + esc(acc.handle) + ' · ' + (state.settings.autoPublish ? '완전 자동 발행 중' : '초안 승인 모드') + '</span></h1>' +

      '<section class="hero">' +
        '<div class="row">' +
          '<div><p class="kicker">오늘 발행</p><p class="big">' + doneToday + ' <small>/ ' + todays.length + '건</small></p></div>' +
          '<svg class="ring" viewBox="0 0 58 58"><circle cx="29" cy="29" r="' + r + '" fill="none" stroke="rgba(255,59,92,.16)" stroke-width="5"/>' +
            '<circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#FF3B5C" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c - c * pct / 100).toFixed(1) + '" transform="rotate(-90 29 29)"/>' +
            '<text x="29" y="33" text-anchor="middle" font-size="12" font-weight="750" fill="#E01F45" font-family="Pretendard, sans-serif">' + pct + '%</text></svg>' +
        '</div>' +
        '<div class="hero-next">' + (next
          ? '<span class="live-dot"></span>다음 발행 <b>' + esc(relDay(next.at)) + ' ' + hhmm(next.at) + '</b><span style="color:var(--muted)">· ' + untilText(next.at) + '</span>'
          : '<span class="live-dot"></span>다음 예약이 없어요 <span style="color:var(--muted)">· 지금 채워 넣을까요?</span>') +
        '</div>' +
      '</section>' +

      '<div class="stats">' +
        statBox(weekSched, '건', '남은 예약') +
        statBox(weekDone, '건', '발행 완료') +
        statBox(saved, '분', '아낀 시간') +
      '</div>' +

      '<h2>다음 예약</h2>' +
      (next
        ? '<div class="card next-card">' +
            '<div class="next-top"><span class="tag accent">' + esc(relDay(next.at)) + ' ' + hhmm(next.at) + '</span>' +
            '<span class="small">' + untilText(next.at) + (next.auto ? ' · 자동 생성' : ' · 직접 예약') + '</span></div>' +
            '<p class="next-text">' + esc(plainText(next.text)) + '</p>' +
            '<div class="next-actions">' +
              '<button class="btn primary sm" data-act="publish-now" data-id="' + next.id + '">' + icon('play', 14) + '지금 발행</button>' +
              '<button class="btn sm" data-act="item" data-id="' + next.id + '">보기 · 수정</button>' +
            '</div>' +
          '</div>'
        : '<div class="card"><p class="small">예약이 비어 있어요. 자동 채우기를 누르면 이번 주 슬롯이 채워집니다.</p>' +
          '<button class="btn primary sm" style="margin-top:12px" data-act="fill-week">이번 주 자동 채우기</button></div>') +

      '<h2>오늘 타임라인<span class="link">' + todays.length + '건</span></h2>' +
      (todays.length
        ? '<div class="tl">' + todays.map(q =>
            '<div class="tl-row" data-act="item" data-id="' + q.id + '" style="cursor:pointer">' +
            '<span class="tl-time">' + hhmm(q.at) + '</span>' +
            '<div class="tl-body"><div class="tl-text">' + esc(excerpt(q.text, 40)) + '</div>' +
            '<div class="tl-meta">' + esc(q.topic) + ' · ' + (TONE_LABEL[q.tone] || '') + (q.formality ? ' · ' + FORMALITY_LABEL[q.formality] : '') + '</div></div>' +
            '<span class="pill ' + (q.status === 'published' ? 'done' : 'wait') + '">' + (q.status === 'published' ? '발행됨' : '대기') + '</span></div>').join('') + '</div>'
        : '<div class="card"><p class="small">오늘 예약된 글이 없어요.</p></div>') +

      '<h2>최근 알림<span class="link" data-act="nav" data-to="log" style="cursor:pointer">전체 보기</span></h2>' +
      '<div class="card">' + (recent.length ? recent.map(l =>
        '<div class="log-row" style="padding:10px 0"><span class="log-ic ' + logIcClass(l.type) + '">' + logIcon(l.type) + '</span>' +
        '<div class="log-main"><div class="log-line">' + esc(l.text) + '</div>' +
        '<div class="log-time">' + esc(relDay(l.at)) + ' ' + hhmm(l.at) + '</div></div></div>').join('')
        : '<p class="small">아직 알림이 없어요.</p>') + '</div>' +

      '<div class="row" style="margin-top:16px;gap:8px">' +
        '<button class="btn line block" data-act="nav" data-to="drafts">' + icon('spark', 16) + '초안 만들기</button>' +
        '<button class="btn line block" data-act="nav" data-to="replies">' + icon('chat', 16) + '자동 답글</button>' +
      '</div>' +
    '</div>';
  }

  function logIcClass(t) { return t === 'publish' ? 'pub' : t === 'reply' ? 'rep' : 'sys'; }
  function logIcon(t) { return icon(t === 'publish' ? 'send' : t === 'reply' ? 'chat' : 'refresh', 16); }

  /* ---------------------------------------------------------------- 뷰: 글 생성 */
  function viewDrafts() {
    const s = state.settings;
    const generating = document.body.classList.contains('generating');
    const drafts = state.drafts.slice().reverse();

    let list = '';
    if (generating) {
      list = [1, 2, 3].map(() => '<div class="skeleton"><div class="sk-line" style="width:38%"></div><div class="sk-line" style="width:92%"></div><div class="sk-line" style="width:86%"></div><div class="sk-line" style="width:64%"></div></div>').join('');
    } else if (drafts.length) {
      list = drafts.map(d => {
        const q = state.queue.find(x => x.status === 'scheduled' && x.text === d.text);
        return '<article class="draft' + (q ? ' scheduled' : '') + '">' +
          '<div class="dhead"><span class="tag accent">' + (TONE_LABEL[d.tone] || '') + '</span>' +
          '<span class="tag">' + esc(FORMALITY_LABEL[d.formality] || '') + '</span>' +
          '<span class="tag">' + esc(d.topic) + '</span><span class="dlen">' + d.text.length + '자</span></div>' +
          '<p class="dtext">' + esc(d.text) + '</p>' +
          '<div class="dmeta"><span class="tag ok">' + icon('shield', 12) + '금지어 통과</span>' +
          (q ? '<span class="tag line">' + esc(relDay(q.at)) + ' ' + hhmm(q.at) + ' 예약</span>' : '') + '</div>' +
          '<div class="dactions">' +
            (q ? '<button class="btn sm" disabled>예약됨</button>'
               : '<button class="btn primary sm" data-act="schedule" data-id="' + d.id + '">' + icon('calendar', 14) + '예약하기</button>') +
            '<button class="btn sm" data-act="copy" data-id="' + d.id + '">' + icon('copy', 14) + '복사</button>' +
            '<span class="spacer"></span>' +
            '<button class="btn ghost-text" data-act="discard" data-id="' + d.id + '">삭제</button>' +
          '</div></article>';
      }).join('');
    } else {
      list = '<div class="card" style="margin-top:10px"><p class="small">아직 만든 초안이 없어요. 위 버튼을 누르면 주제와 말투에 맞춰 3개를 만들어 드립니다.</p></div>';
    }

    return '<div class="page">' +
      '<h1>글 생성<span class="sub">AI가 계정 톤에 맞춰 초안 3개를 만듭니다</span></h1>' +
      '<div class="mode-banner">' + icon('edit', 14) + '지금 초안은 <b>' + (TONE_LABEL[s.tone] || '') + ' · ' + FORMALITY_LABEL[s.formality || 'casual'] + '</b>로 나와요' +
        '<button class="link-btn" data-act="nav" data-to="settings">바꾸기</button></div>' +

      (s.autoPublish
        ? '<div class="card" style="margin-top:14px;background:linear-gradient(150deg,#FFF6F8,#FFF1F4);border-color:rgba(255,59,92,.14)">' +
            '<div class="row"><div style="display:flex;gap:9px;align-items:center">' +
              '<span class="tag solid">자동</span><span style="font-size:13px;font-weight:700">완전 자동 모드 켜짐</span></div>' +
              '<button class="toggle on" data-act="toggle-auto" aria-label="완전 자동 발행"></button></div>' +
            '<p class="small" style="margin-top:9px">초안을 고르지 않아도 정한 시간에 맞춰 자동으로 발행됩니다. 발행되면 알림만 옵니다.</p>' +
            '<button class="btn sm" style="margin-top:11px;background:#fff" data-act="fill-week">' + icon('refresh', 14) + '이번 주 빈 슬롯 채우기</button>' +
          '</div>'
        : '<div class="card" style="margin-top:14px"><div class="row"><span style="font-size:13px;font-weight:700">초안 승인 모드</span>' +
            '<button class="toggle" data-act="toggle-auto" aria-label="완전 자동 발행"></button></div>' +
            '<p class="small" style="margin-top:8px">만든 초안을 직접 골라 예약합니다.</p></div>') +

      '<div class="gen-card">' +
        '<div class="gen-top"><div class="gen-icon">' + icon('spark', 20) + '</div>' +
          '<div><div class="gen-title">오늘의 초안</div><div class="gen-sub">' + esc(s.topics.join(' · ')) + ' · ' + (TONE_LABEL[s.tone] || '') + ' · ' + FORMALITY_LABEL[s.formality || 'casual'] + '</div></div></div>' +
        '<div class="gen-ctx">' +
          '<span class="tag accent">' + FORMALITY_LABEL[s.formality || 'casual'] + ' 모드</span>' +
          '<span class="tag line">' + icon('shield', 11) + '금지어 ' + s.banned.length + '개</span>' +
          '<span class="tag line">하루 ' + s.perDay + '회</span>' +
          '<span class="tag line">' + esc(s.slots.slice(0, s.perDay).join(' / ')) + '</span>' +
        '</div>' +
        '<button class="btn primary block" data-act="gen">' + icon('spark', 17) + ' AI 초안 생성</button>' +
      '</div>' +

      '<h2>생성된 초안' + (drafts.length ? '<span class="link">' + drafts.length + '개</span>' : '') + '</h2>' +
      list +
      '<p class="fine" style="margin-top:16px">데모에서는 템플릿 조합으로 만듭니다. 실제 서비스에서는 LLM이 계정의 과거 글을 학습해 톤을 맞춥니다.</p>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 캘린더 */
  function viewCalendar() {
    const off = state.week || 0;
    const w0 = startOfWeek(off);
    const today0 = dayStart();
    const days = [];
    for (let i = 0; i < 7; i++) days.push(w0 + i * DAY);
    const wItems = state.queue.filter(q => q.at >= w0 && q.at < w0 + 7 * DAY && q.status !== 'canceled');
    const done = wItems.filter(q => q.status === 'published').length;
    const sched = wItems.filter(q => q.status === 'scheduled').length;
    const d1 = new Date(w0), d2 = new Date(w0 + 6 * DAY);

    const body = days.map(ms => {
      const dd = new Date(ms);
      const items = state.queue.filter(q => q.at >= ms && q.at < ms + DAY && q.status !== 'canceled').sort((a, b) => a.at - b.at);
      const isToday = ms === today0;
      return '<div class="day' + (isToday ? ' today' : '') + '">' +
        '<div class="day-head"><span class="dow">' + DOW[dd.getDay()] + '</span><span class="dnum">' + dd.getDate() + '</span>' +
        (isToday ? '<span class="badge-today">오늘</span>' : '') +
        '<span class="day-count">' + (items.length ? items.length + '건' : '비어 있음') + '</span></div>' +
        (items.length
          ? items.map(q => '<button class="slot ' + (q.status === 'published' ? 'published' : '') + '" data-act="item" data-id="' + q.id + '">' +
              '<span class="st">' + hhmm(q.at) + '</span><span class="sx">' + esc(excerpt(q.text, 30)) + '</span><span class="sd"></span></button>').join('')
          : '<div class="day-empty">' + icon('clock', 14) + '예약 없음 <button class="btn xs" data-act="fill-week" style="margin-left:auto">' + icon('plus', 12) + '채우기</button></div>') +
      '</div>';
    }).join('');

    return '<div class="page">' +
      '<h1>예약 캘린더<span class="sub">정한 시간에 맞춰 자동으로 발행됩니다</span></h1>' +
      '<div class="weekbar"><span class="wk">' + (d1.getMonth() + 1) + '월 ' + d1.getDate() + '일 – ' + (d2.getMonth() + 1) + '월 ' + d2.getDate() + '일</span>' +
        '<span class="wnav"><button data-act="prev-week" aria-label="이전 주">' + icon('left', 16) + '</button>' +
        '<button data-act="next-week" aria-label="다음 주">' + icon('right', 16) + '</button></span></div>' +
      '<div class="summary">' +
        '<div class="box"><b>' + sched + '</b><span>남은 예약</span></div>' +
        '<div class="box"><b>' + done + '</b><span>발행 완료</span></div>' +
        '<div class="box"><b>' + wItems.length + '</b><span>전체</span></div>' +
      '</div>' +
      body +
      '<p class="fine" style="margin-top:14px">항목을 누르면 문구·시각 확인, 수정, 지금 발행, 취소가 가능합니다.</p>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 로그 */
  let logFilter = 'all';
  function viewLog() {
    const logs = state.logs.slice().sort((a, b) => b.at - a.at).filter(l => logFilter === 'all' || l.type === logFilter);
    const groups = [];
    let cur = null;
    logs.forEach(l => {
      const k = dayKey(l.at);
      if (!cur || cur.key !== k) { cur = { key: k, at: l.at, items: [] }; groups.push(cur); }
      cur.items.push(l);
    });
    const filters = [['all', '전체'], ['publish', '발행'], ['reply', '답글'], ['system', '시스템']];

    return '<div class="page">' +
      '<h1>발행 로그<span class="sub">예약이 실행될 때마다 기록됩니다</span></h1>' +
      '<div class="filters">' + filters.map(f => '<button class="chip ' + (logFilter === f[0] ? 'on' : '') + '" data-act="log-filter" data-f="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
      (groups.length ? groups.map(g =>
        '<div class="log-group"><div class="log-date">' + esc(relDay(g.at)) + ' · ' + g.key.replace(/-/g, '.') + '</div>' +
        g.items.map(l => '<div class="log-row"><span class="log-ic ' + logIcClass(l.type) + '">' + logIcon(l.type) + '</span>' +
          '<div class="log-main"><div class="log-line">' + esc(l.text) + '</div>' +
          '<div class="log-time">' + hhmm(l.at) + ' · ' + (l.type === 'publish' ? (l.auto === false ? '직접 발행' : '자동 발행') : l.type === 'reply' ? '자동 답글' : '시스템') + '</div>' +
          (l.qid ? '<button class="log-open" data-act="item" data-id="' + l.qid + '">문구 보기</button>' : '') +
          '</div></div>').join('') + '</div>').join('')
        : '<div class="card" style="margin-top:16px"><p class="small">기록이 없어요.</p></div>') +
      '<p class="fine" style="margin-top:18px">데모 모드 · 실제 스레드에는 게시되지 않으며 발행 기록만 시뮬레이션합니다.</p>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 설정 */
  function viewSettings() {
    const s = state.settings;
    const acc = activeAccount();
    const plan = PLANS[state.plan] || PLANS.trial;
    const trialLeft = trialLeftDays();
    const me = auth.session || {};
    const formality = s.formality === 'formal' ? 'formal' : 'casual';

    const acctRows = state.accounts.map(a =>
      '<div class="acct-row"><span class="avatar" style="background:' + a.color + ';width:34px;height:34px;font-size:13px">' + esc(a.name.slice(0, 1)) + '</span>' +
      '<div><div class="acct-name">' + esc(a.name) + '</div><div class="acct-h">' + esc(a.handle) + '</div></div>' +
      '<span class="acct-state">' + (a.id === state.active
        ? '<span class="tag accent">대표</span>'
        : '<button class="btn xs" data-act="switch-acct" data-id="' + a.id + '">대표로</button>') + '</span></div>').join('');

    return '<div class="page">' +
      '<h1>설정<span class="sub">지금은 <b>' + FORMALITY_LABEL[formality] + '</b> 모드예요 · 초안과 자동 답글이 함께 바뀝니다</span></h1>' +

      '<div class="sec-label">내 정보</div>' +
      '<div class="set-card">' +
        '<div class="prof-row">' +
          '<span class="prof-av">' + esc((me.name || '?').slice(0, 1)) + '</span>' +
          '<div class="prof-body"><div class="prof-name">' + esc(me.name || '이름 없음') + '</div>' +
          '<div class="prof-mail">' + esc(me.email || '이메일 없음') + '</div></div>' +
          '<span class="tag ' + (state.plan === 'trial' ? 'accent' : 'ok') + '">' + (state.plan === 'trial' ? 'D-' + trialLeft : '구독 중') + '</span>' +
        '</div>' +
        '<div class="set-row static"><span class="ic">' + icon('shield', 16) + '</span>' +
        '<div><div class="lab">로그인 상태</div><div class="desc">이 기기에만 저장됨 · 데모 인증</div></div>' +
        '<span class="val">' + icon('check', 16, 2.2) + '</span></div>' +
      '</div>' +

      '<div class="sec-label">계정</div>' +
      '<div class="set-card">' + acctRows +
        '<button class="set-row" data-act="connect-open"><span class="ic">' + icon('plus', 16) + '</span>' +
        '<div><div class="lab">계정 추가</div><div class="desc">스레드 계정을 더 연결합니다</div></div>' +
        '<span class="val">' + icon('right', 15) + '</span></button>' +
      '</div>' +
      '<p class="fine" style="margin-top:8px;padding-left:2px">새 글은 대표 계정으로 발행되고, 예약은 연결된 계정 모두에서 공유됩니다.</p>' +

      '<div class="sec-label">발행 주제</div>' +
      '<div class="card flat"><div class="chips">' +
        s.topics.map(t => '<span class="chip on">' + esc(t) + '<button class="x" data-act="del-topic" data-t="' + esc(t) + '" aria-label="삭제" style="border:0;background:transparent;padding:0;cursor:pointer">' + icon('x', 13) + '</button></span>').join('') +
      '</div>' +
      '<div class="field" style="margin-top:10px"><input class="input" id="topic-input" placeholder="주제 추가 (예: 다이어트)" maxlength="16" />' +
      '<button class="mini-btn" data-act="add-topic">추가</button></div></div>' +

      '<div class="sec-label">말투 <span style="font-weight:600;color:var(--muted2)">· 글 초안과 댓글 답글에 같이 적용</span></div>' +
      '<div class="card flat">' +
        '<div class="seg">' +
          FORMALITIES.map(f => '<button class="' + (formality === f.id ? 'on' : '') + '" data-act="formality" data-f="' + f.id + '">' + f.label + '</button>').join('') +
        '</div>' +
        '<p class="small" style="margin-top:9px">' + (FORMALITIES.find(f => f.id === formality) || FORMALITIES[0]).hint + '</p>' +
        '<div class="sec-label" style="margin:14px 0 8px">톤</div>' +
        '<div class="seg">' +
          TONES.map(t => '<button class="' + (s.tone === t.id ? 'on' : '') + '" data-act="tone" data-tone="' + t.id + '">' + t.label + '</button>').join('') +
        '</div>' +
        '<p class="small" style="margin-top:9px">' + toneHint(s.tone, formality) + '</p>' +
        '<div class="sample-line"><span class="tag accent">예시</span><p>' + esc((FORMALITIES.find(f => f.id === formality) || FORMALITIES[0]).sample) + '</p></div>' +
      '</div>' +

      '<div class="sec-label">금지어 <span style="font-weight:600;color:var(--muted2)">· 이 단어가 들어간 초안은 걸러집니다</span></div>' +
      '<div class="card flat"><div class="chips">' +
        s.banned.map(b => '<span class="chip">' + esc(b) + '<button class="x" data-act="del-ban" data-t="' + esc(b) + '" aria-label="삭제" style="border:0;background:transparent;padding:0;cursor:pointer">' + icon('x', 13) + '</button></span>').join('') +
        (s.banned.length ? '' : '<span class="small">등록된 금지어가 없어요</span>') +
      '</div>' +
      '<div class="field" style="margin-top:10px"><input class="input" id="ban-input" placeholder="금지어 추가 (예: 최저가)" maxlength="12" />' +
      '<button class="mini-btn" data-act="add-ban">추가</button></div></div>' +

      '<div class="sec-label">발행량 · 시간</div>' +
      '<div class="card flat">' +
        '<div class="row"><div><div class="lab" style="font-size:13.5px;font-weight:650">하루 발행 횟수</div>' +
        '<div class="desc" style="font-size:11.5px;color:var(--muted);margin-top:2px">1~5회</div></div>' +
        '<div class="stepper"><button data-act="per-dec" ' + (s.perDay <= 1 ? 'disabled' : '') + '>−</button><span>' + s.perDay + '</span>' +
        '<button data-act="per-inc" ' + (s.perDay >= 5 ? 'disabled' : '') + '>+</button></div></div>' +
        '<div class="sec-label" style="margin:14px 0 8px">발행 시간대</div>' +
        '<div class="chips">' +
          s.slots.map(t => '<span class="chip on">' + t + '<button class="x" data-act="del-slot" data-t="' + t + '" aria-label="삭제" style="border:0;background:transparent;padding:0;cursor:pointer">' + icon('x', 13) + '</button></span>').join('') +
        '</div>' +
        '<div class="field" style="margin-top:10px"><input type="time" class="time-input" id="slot-input" value="21:00" />' +
        '<button class="mini-btn" data-act="add-slot">시간 추가</button></div>' +
        (s.slots.length < s.perDay ? '<p class="fine" style="margin-top:9px;color:var(--warn)">하루 ' + s.perDay + '회인데 시간대가 ' + s.slots.length + '개예요. 시간대를 더 추가해 주세요.</p>' : '') +
      '</div>' +

      '<div class="sec-label">자동화</div>' +
      '<div class="set-card">' +
        '<div class="set-row static"><span class="ic">' + icon('bolt', 16) + '</span>' +
        '<div><div class="lab">완전 자동 발행</div><div class="desc">초안 확인 없이 정한 시간에 발행</div></div>' +
        '<span class="val"><button class="toggle ' + (s.autoPublish ? 'on' : '') + '" data-act="toggle-auto" aria-label="완전 자동 발행"></button></span></div>' +
        '<button class="set-row" data-act="nav" data-to="replies"><span class="ic">' + icon('chat', 16) + '</span>' +
        '<div><div class="lab">댓글 자동 답글</div><div class="desc">' + (s.replies.enabled ? TONE_LABEL[s.replies.tone] + ' · ' + FORMALITY_LABEL[formality] + '로 응답' : '꺼짐') + '</div></div>' +
        '<span class="val">' + icon('right', 15) + '</span></button>' +
      '</div>' +

      '<div class="sec-label">구독</div>' +
      '<div class="set-card"><button class="set-row" data-act="nav" data-to="pricing"><span class="ic">' + icon('card', 16) + '</span>' +
        '<div><div class="lab">요금제</div><div class="desc">' + esc(plan.name) + (state.plan === 'trial' ? ' · ' + trialLeft + '일 남음' : ' · 월 ' + won(plan.price) + '원') + '</div></div>' +
        '<span class="val">' + icon('right', 15) + '</span></button></div>' +

      '<div class="sec-label">앱</div>' +
      '<div class="set-card">' +
        '<div class="set-row static"><span class="ic">' + icon('info', 16) + '</span>' +
        '<div><div class="lab">홈 화면에 추가</div><div class="desc">공유 → 홈 화면에 추가 (PWA)</div></div></div>' +
        '<button class="set-row" data-act="reset"><span class="ic">' + icon('refresh', 16) + '</span>' +
        '<div><div class="lab">데모 데이터 초기화</div><div class="desc">계정 연결·예약·로그를 지우고 처음으로 (로그인 유지)</div></div></button>' +
        '<div class="set-row static"><span class="ic">' + icon('shield', 16) + '</span>' +
        '<div><div class="lab">버전</div><div class="desc">ThreadPilot 0.9.3 (프로토타입)</div></div></div>' +
      '</div>' +

      '<div class="sec-label">' + esc(OP_LINE) + '</div>' +
      '<div class="set-card">' +
        '<button class="set-row" data-act="nav" data-to="admin"><span class="ic">' + opLogo(16) + '</span>' +
        '<div><div class="lab">붐비다 관리자 콘솔</div><div class="desc">고객 계정 · 자동 발행 상태 관리</div></div>' +
        '<span class="val"><span class="tag accent">관리자</span></span></button>' +
        '<div class="set-row static"><span class="ic">' + icon('info', 16) + '</span>' +
        '<div><div class="lab">데모 · 로컬 시뮬레이션</div><div class="desc">실제 서버 DB 연동 전 화면입니다</div></div></div>' +
      '</div>' +

      '<button class="btn line block" data-act="logout" style="margin-top:16px;color:var(--accent-deep)">' + icon('user', 16) + '로그아웃</button>' +
      '<p class="fine" style="margin-top:12px">' + (me.email ? esc(me.email) + ' 로 로그인됨 · ' : '') + '데모 모드입니다. 실제 스레드 계정에는 게시되지 않습니다.</p>' +
      operatorFooter() +
    '</div>';
  }

  /* ------------------------------------------------------- 뷰: 관리자 콘솔
     운영자용 화면(#/admin). 실제 서버·DB 연동 전 단계라 고객·발행·오류 값은
     이 브라우저(localStorage)에서만 도는 로컬 시뮬레이션입니다. 실제 고객
     데이터로 오해되지 않도록 화면 상단에 '데모 · 로컬 시뮬레이션' 배지를 둡니다.
     실서비스에서는 운영자 역할 검사 + 서버 API가 필요합니다(PLAN.md 7장).
  ------------------------------------------------------------------------ */
  const ADMIN_KEY = 'threadpilot.admin.v1';
  const ADMIN_PLAN_ORDER = ['trial', 'standard', 'pro', 'agency'];
  const ADMIN_PLAN_LABEL = { trial: '체험', standard: '스탠다드', pro: '프로', agency: '에이전시' };
  let admin = seedAdmin();
  let admFilter = 'all';   // all | ok | paused
  let admQuery = '';

  // 오늘 안쪽으로 당긴 'n분 전' — 자정 직후에 열어도 오늘 KPI와 로그 날짜가 어긋나지 않게
  function agoMin(n) {
    return Math.max(Date.now() - n * MIN, dayStart() + MIN);
  }

  function seedAdmin() {
    const log = (id, customerId, kind, mins, text, extra) => Object.assign({
      id: 'al-' + id, customerId, kind, at: agoMin(mins), text, state: 'ok', retry: null
    }, extra || {});
    return {
      v: 1,
      customers: [
        { id: 'cu-sushi', name: '스시 미도', biz: '일식 스시집', handle: '@mido.sushi', plan: 'pro', auto: true, since: '2026-08-21', trialEnds: null, color: '#1F6F5C' },
        { id: 'cu-beauty', name: '글로우 뷰티랩', biz: '뷰티샵', handle: '@glow.lab', plan: 'standard', auto: true, since: '2026-09-14', trialEnds: null, color: '#C2489B' },
        { id: 'cu-yoga', name: '한강 요가 스튜디오', biz: '요가원', handle: '@hangang.yoga', plan: 'agency', auto: true, since: '2026-07-03', trialEnds: null, color: '#7A5AF8' },
        { id: 'cu-cafe', name: '카페 무드', biz: '카페', handle: '@cafe.mood', plan: 'trial', auto: false, since: '2026-11-02', trialEnds: agoMin(2880), color: '#B26A00' },
        { id: 'cu-crossfit', name: '아이언핏 크로스핏', biz: '크로스핏 박스', handle: '@ironfit.box', plan: 'standard', auto: false, since: '2026-10-05', trialEnds: null, color: '#3B6EF6' }
      ],
      logs: [
        log('1', 'cu-sushi', 'publish', 12, '오늘의 오마카세 — 홋카이도 산 우니 입고 안내'),
        log('2', 'cu-sushi', 'reply', 18, '@sushi_lover 님 댓글에 답글 — 예약은 DM으로 받습니다'),
        log('3', 'cu-sushi', 'publish', 46, '금요일 저녁 예약석 2자리 남았습니다'),
        log('4', 'cu-sushi', 'reply', 52, '@mika.eats 님 댓글에 답글 — 건물 뒤 주차 3대 가능'),
        log('5', 'cu-beauty', 'publish', 25, '가을 톤다운 컬러 — 11월 예약 오픈'),
        log('6', 'cu-beauty', 'reply', 33, '@glow_fan 님 댓글에 답글 — 소요 시간 90분입니다'),
        log('7', 'cu-beauty', 'publish', 74, '속눈썹 연장 신규 고객 20% 안내'),
        log('8', 'cu-beauty', 'reply', 88, '@dayeon.h 님 댓글에 답글 — 주차 안내'),
        log('9', 'cu-yoga', 'publish', 21, '겨울 특강 — 초보자 4주 코스 모집'),
        log('10', 'cu-yoga', 'reply', 29, '@yoga_min 님 댓글에 답글 — 매트 대여 가능합니다'),
        log('11', 'cu-yoga', 'publish', 96, '오전 7시 클래스 신설 — 출근 전 50분'),
        log('12', 'cu-cafe', 'system', 61, '무료 체험 종료(D-0) — 자동 발행이 멈췄습니다', { state: 'paused' }),
        log('13', 'cu-cafe', 'error', 62, '스레드 API 401 — 액세스 토큰 만료로 마지막 발행 실패', { state: 'error' }),
        log('14', 'cu-crossfit', 'error', 40, '스레드 API 429 — 발행 한도 초과 (다음 슬롯에 재시도 대기)', { state: 'waiting', retry: 'waiting' }),
        log('15', 'cu-crossfit', 'publish', 120, '오늘 19시 클래스 — 스쿼트 자세 교정'),
        log('16', 'cu-crossfit', 'system', 70, '고객 요청으로 자동 발행 일시정지', { state: 'paused' })
      ],
      seq: 0
    };
  }

  function loadAdmin() {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (p && p.v === 1 && Array.isArray(p.customers) && Array.isArray(p.logs)) { admin = p; return; }
      admin = seedAdmin();
      saveAdmin();
    } catch (e) { admin = seedAdmin(); }
  }
  function saveAdmin() {
    try { localStorage.setItem(ADMIN_KEY, JSON.stringify(admin)); } catch (e) { /* ignore */ }
  }
  function adminLog(customerId, kind, text, state, retry) {
    admin.logs.push({ id: uid('al-'), customerId, kind, at: Date.now(), text, state: state || 'ok', retry: retry || null });
    if (admin.logs.length > 240) admin.logs = admin.logs.slice(-240);
  }

  // 데모 고객 목록 + 지금 로그인한 데모 계정을 같은 모양으로 정리
  function adminRows() {
    const t0 = dayStart();
    const rows = admin.customers.map(c => {
      const logs = admin.logs.filter(l => l.customerId === c.id);
      let status = c.auto ? 'active' : 'paused';
      if (c.plan === 'trial' && c.trialEnds && c.trialEnds <= Date.now()) status = 'expired';
      return Object.assign({}, c, {
        posts: logs.filter(l => l.kind === 'publish' && l.at >= t0).length,
        replies: logs.filter(l => l.kind === 'reply' && l.at >= t0).length,
        status, me: false
      });
    });
    if (isLoggedIn()) {
      const u = sessionUser() || {};
      const acc = activeAccount();
      const on = !!state.settings.autoPublish;
      rows.unshift({
        id: 'me', me: true,
        name: acc ? acc.name : (u.name || '내 계정'),
        biz: '내 데모 계정',
        handle: acc ? acc.handle : (u.email || ''),
        plan: state.plan, auto: on, color: acc ? acc.color : '#FF3B5C',
        status: on ? 'active' : 'paused', trialEnds: null,
        posts: state.logs.filter(l => l.type === 'publish' && l.at >= t0).length,
        replies: state.logs.filter(l => l.type === 'reply' && l.at >= t0).length
      });
    }
    return rows;
  }

  function adminStatusPill(r) {
    if (r.status === 'expired') return '<span class="pill err">체험만료</span>';
    if (r.status === 'paused') return '<span class="pill off">일시정지</span>';
    return '<span class="pill done">정상</span>';
  }

  // 관리자 콘솔 로그 = 데모 고객 로그 + 내 계정 로그(앱에서 실제로 쌓인 기록)
  function adminLogRows(rows) {
    rows = rows || adminRows();
    const byId = {};
    rows.forEach(r => { byId[r.id] = r; });
    const q = admQuery.trim().toLowerCase();
    const t0 = dayStart();
    const list = admin.logs.filter(l => l.at >= t0).map(l => {
      const c = byId[l.customerId] || null;
      return {
        id: l.id, at: l.at, kind: l.kind, text: l.text, retry: l.retry,
        custName: c ? c.name : '고객', custStatus: c ? c.status : 'active'
      };
    });
    if (isLoggedIn()) {
      const me = byId['me'];
      state.logs.forEach(l => {
        if (l.type !== 'publish' && l.type !== 'reply') return;
        if (l.at < t0) return;
        list.push({
          id: 'me-' + l.id, at: l.at, kind: l.type, text: l.text, retry: null,
          custName: me ? me.name : '내 계정', custStatus: me ? me.status : 'active'
        });
      });
    }
    return list.filter(l => {
      if (admFilter === 'ok' && l.custStatus !== 'active') return false;
      if (admFilter === 'paused' && l.custStatus !== 'paused') return false;
      if (!q) return true;
      return ((l.text || '') + ' ' + l.custName).toLowerCase().indexOf(q) !== -1;
    }).sort((a, b) => b.at - a.at).slice(0, 30);
  }

  function openAdminPlanSheet(id) {
    if (id === 'me') { go('pricing'); return; }
    const r = adminRows().find(x => x.id === id);
    if (!r) return;
    const opts = ADMIN_PLAN_ORDER.map(p => {
      const pl = PLANS[p];
      return '<button class="adm-plan-opt' + (r.plan === p ? ' on' : '') + '" data-act="adm-plan-pick" data-id="' + r.id + '" data-plan="' + p + '">' +
        '<span class="apo-t"><b>' + ADMIN_PLAN_LABEL[p] + '</b><span>' + (pl.price ? '월 ' + won(pl.price) + '원' : '14일 무료 체험') + '</span></span>' +
        (r.plan === p ? '<span class="apo-on">' + icon('check', 15, 2.4) + '</span>' : '') + '</button>';
    }).join('');
    openSheet('<h3>요금제 변경</h3><p class="sh-sub">' + esc(r.name) + ' · ' + esc(r.handle) + '</p>' +
      '<div class="sheet-body">' + opts +
      '<p class="fine" style="margin-top:10px">데모입니다. 결제 없이 이 기기의 상태만 바뀝니다.</p></div>' +
      '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">닫기</button></div>');
  }

  function openAdminLogSheet(id) {
    const r = adminRows().find(x => x.id === id);
    if (!r) return;
    let items;
    if (id === 'me') {
      items = state.logs.filter(l => l.type === 'publish' || l.type === 'reply')
        .map(l => ({ at: l.at, kind: l.type, text: l.text, retry: null }));
    } else {
      items = admin.logs.filter(l => l.customerId === id)
        .map(l => ({ at: l.at, kind: l.kind, text: l.text, retry: l.retry }));
    }
    items.sort((a, b) => b.at - a.at);
    const body = items.length ? items.slice(0, 40).map(l =>
      '<div class="adm-sheet-log"><span class="adm-log-t">' + (l.at >= dayStart() ? '오늘 ' : '') + hhmm(l.at) + '</span>' +
      (l.retry === 'done' ? '<span class="pill done">재시도 완료</span>' : l.retry === 'waiting' ? '<span class="pill err">재시도 대기</span>' : l.kind === 'error' ? '<span class="pill err">오류</span>' : '') +
      '<p>' + esc(l.text) + '</p></div>').join('') : '<p class="small">아직 기록이 없어요.</p>';
    openSheet('<h3>' + esc(r.name) + '</h3>' +
      '<p class="sh-sub">' + esc(r.handle) + ' · ' + ADMIN_PLAN_LABEL[r.plan] + ' · 오늘 글 ' + r.posts + ' / 답글 ' + r.replies + '</p>' +
      '<div class="sheet-body">' + body + '</div>' +
      '<div class="sheet-actions">' +
      (r.me ? '' : '<button class="btn line" data-act="adm-plan" data-id="' + r.id + '">요금제 변경</button>') +
      '<button class="btn dark" data-act="close-sheet">닫기</button></div>');
  }

  function viewAdmin() {
    const rows = adminRows();
    const q = admQuery.trim().toLowerCase();
    const hit = r => !q || (r.name + ' ' + r.biz + ' ' + r.handle).toLowerCase().indexOf(q) !== -1;
    const shown = rows.filter(r => hit(r) && (admFilter === 'all' ||
      (admFilter === 'ok' ? r.status === 'active' : r.status === 'paused')));
    const activeCount = rows.filter(r => r.status === 'active').length;
    const mrr = rows.reduce((sum, r) => sum + (r.status === 'active' ? ((PLANS[r.plan] || {}).price || 0) : 0), 0);
    const posts = rows.reduce((sum, r) => sum + r.posts, 0);
    const replies = rows.reduce((sum, r) => sum + r.replies, 0);
    const waiting = admin.logs.filter(l => l.retry === 'waiting').length;
    const filters = [['all', '전체'], ['ok', '정상'], ['paused', '일시정지']];

    const kpi = (label, v, unit, sub, cls) =>
      '<div class="adm-kpi' + (cls ? ' ' + cls : '') + '"><div class="k">' + label + '</div>' +
      '<div class="v">' + v + (unit ? '<span>' + unit + '</span>' : '') + '</div><div class="s">' + sub + '</div></div>';

    const cards = shown.map(r => {
      const pl = PLANS[r.plan] || PLANS.trial;
      const sw = '<span class="adm-sw ' + (r.auto ? 'on' : '') + '"><i></i></span>';
      const toggle = r.status === 'expired'
        ? ''
        : r.me
          ? '<button class="adm-act" data-act="adm-toggle-me" aria-label="자동 발행 일시정지/재개">' + sw + (r.auto ? '일시정지' : '재개') + '</button>'
          : '<button class="adm-act" data-act="adm-toggle" data-id="' + r.id + '" aria-label="자동 발행 일시정지/재개">' + sw + (r.auto ? '일시정지' : '재개') + '</button>';
      const planBtn = r.me
        ? '<button class="adm-act" data-act="nav" data-to="pricing">요금제</button>'
        : '<button class="adm-act" data-act="adm-plan" data-id="' + r.id + '">요금제 변경</button>';
      return '<div class="adm-card">' +
        '<div class="adm-head">' +
          '<span class="avatar" style="background:' + esc(r.color || '#111114') + ';width:32px;height:32px;font-size:12.5px">' + esc((r.name || '?').slice(0, 1)) + '</span>' +
          '<div class="adm-id"><div class="adm-name">' + esc(r.name) + (r.me ? '<span class="tag accent">현재 계정</span>' : '') + '</div>' +
          '<div class="adm-sub2">' + esc(r.biz) + ' · ' + esc(r.handle) + '</div></div>' +
          adminStatusPill(r) +
        '</div>' +
        '<div class="adm-meta">' +
          '<span class="tag ' + (r.plan === 'trial' ? 'line' : 'accent') + '">' + ADMIN_PLAN_LABEL[r.plan] + (pl.price ? ' · ' + (pl.price / 10000) + '만' : ' · 무료') + '</span>' +
          '<span class="adm-cnt">오늘 글 <b>' + r.posts + '</b> · 답글 <b>' + r.replies + '</b></span>' +
        '</div>' +
        '<div class="adm-acts">' + toggle + planBtn +
          '<button class="adm-act" data-act="adm-logs" data-id="' + r.id + '">로그 보기</button></div>' +
      '</div>';
    }).join('');

    const logItems = adminLogRows(rows);
    const logHtml = logItems.length ? logItems.map(l => {
      const ic = l.kind === 'publish' ? 'pub' : l.kind === 'reply' ? 'rep' : 'sys';
      const icName = l.kind === 'publish' ? 'send' : l.kind === 'reply' ? 'chat' : 'refresh';
      const pill = l.retry === 'done' ? '<span class="pill done">재시도 완료</span>'
        : l.retry === 'waiting' ? '<span class="pill err">재시도 대기</span>'
          : l.kind === 'error' ? '<span class="pill err">오류</span>'
            : l.kind === 'system' ? '<span class="pill off">상태 변경</span>'
              : '<span class="pill done">정상</span>';
      return '<div class="adm-log"><span class="log-ic ' + ic + '">' + icon(icName, 15) + '</span>' +
        '<div class="adm-log-main"><div class="adm-log-top"><b>' + esc(l.custName) + '</b>' +
        '<span class="adm-log-t">' + hhmm(l.at) + '</span>' + pill + '</div>' +
        '<div class="adm-log-text">' + esc(l.text) + '</div>' +
        (l.retry === 'waiting' ? '<button class="log-open" data-act="adm-retry" data-id="' + l.id + '">지금 재시도</button>' : '') +
        '</div></div>';
    }).join('') : '<p class="small">조건에 맞는 로그가 없어요.</p>';

    return '<div class="page adm">' +
      '<div class="adm-top"><button class="adm-back" data-act="nav" data-to="' + (isLoggedIn() ? 'settings' : 'login') + '" aria-label="뒤로 가기">' + icon('left', 18) + '</button>' +
      '<span class="adm-badge">데모 · 로컬 시뮬레이션</span></div>' +
      '<h1>붐비다 관리자 콘솔<span class="sub">고객 계정과 자동 발행 상태를 한 화면에서 관리합니다</span></h1>' +
      '<div class="adm-note"><b>데모 · 로컬 시뮬레이션</b> — 실제 서버 DB 연동 전 화면입니다. 고객·발행·오류 값은 이 기기 브라우저(localStorage)에만 저장되고, 실제 스레드 계정이나 붐비다 서버와 연결되지 않습니다.</div>' +
      '<div class="adm-kpis">' +
        kpi('활성 고객', activeCount, '곳', '전체 ' + rows.length + '곳 중') +
        kpi('이번 달 구독(MRR)', (mrr / 10000).toFixed(1), '만원', '정상 고객 월 합계') +
        kpi('오늘 전체 발행', posts, '건', '답글 ' + replies + '건 별도') +
        kpi('오류 · 재시도 대기', waiting, '건', waiting ? '재시도 필요' : '오류 없음', waiting ? 'alert' : '') +
      '</div>' +
      '<div class="adm-bar">' +
        '<div class="adm-search">' + icon('search', 16) +
        '<input class="input" id="adm-q" type="search" value="' + esc(admQuery) + '" placeholder="고객 · 핸들 · 로그 검색" autocomplete="off" /></div>' +
        '<div class="filters adm-filters">' + filters.map(f => '<button class="chip ' + (admFilter === f[0] ? 'on' : '') + '" data-act="adm-filter" data-f="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>' +
      '</div>' +
      '<div class="sec-label">고객 계정 <span class="adm-count">' + shown.length + '곳 표시</span></div>' +
      (cards || '<div class="card flat"><p class="small">조건에 맞는 고객이 없어요.</p></div>') +
      '<div class="sec-label">최근 발행 · 오류 로그 <span class="adm-count">' + logItems.length + '건</span></div>' +
      '<div class="card flat adm-logs">' + logHtml + '</div>' +
      '<button class="btn line block" data-act="adm-reset" style="margin-top:14px">' + icon('refresh', 15) + '시뮬레이션 데이터 초기화</button>' +
      '<p class="fine" style="margin-top:10px">실서비스에서는 운영자 역할(권한) 검사와 서버 API가 필요합니다. 이 화면은 데모 흐름 확인용입니다.</p>' +
      operatorFooter() +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 자동 답글 */
  function viewReplies() {
    const r = state.settings.replies;
    const delayOpts = ['즉시', '1분', '5분'];
    return '<div class="page">' +
      '<h1>댓글 자동 답글<span class="sub">댓글이 달리면 정한 톤으로 답글을 답니다</span></h1>' +
      '<div class="mode-banner">' + icon('chat', 14) + '답글은 <b>' + (TONE_LABEL[r.tone] || '') + ' · ' + FORMALITY_LABEL[state.settings.formality || 'casual'] + '</b>로 나가요' +
        '<button class="link-btn" data-act="nav" data-to="settings">바꾸기</button></div>' +

      '<div class="card" style="margin-top:14px"><div class="row">' +
        '<div><div style="font-size:14px;font-weight:750">자동 답글</div><div class="small" style="margin-top:3px">' + (r.enabled ? '새 댓글을 감지해 자동으로 답글을 씁니다' : '꺼져 있어요') + '</div></div>' +
        '<button class="toggle ' + (r.enabled ? 'on' : '') + '" data-act="toggle-replies" aria-label="자동 답글"></button></div></div>' +

      '<div class="sec-label">답글 말투 <span style="font-weight:600;color:var(--muted2)">· 발행 글과 같이 적용</span></div>' +
      '<div class="card flat">' +
        '<div class="seg">' +
          FORMALITIES.map(f => '<button class="' + ((state.settings.formality || 'casual') === f.id ? 'on' : '') + '" data-act="formality" data-f="' + f.id + '">' + f.label + '</button>').join('') +
        '</div>' +
        '<p class="small" style="margin-top:9px">' + (FORMALITIES.find(f => f.id === (state.settings.formality || 'casual')) || FORMALITIES[0]).hint + '</p>' +
        '<div class="sec-label" style="margin:14px 0 8px">톤</div>' +
        '<div class="seg">' +
          TONES.map(t => '<button class="' + (r.tone === t.id ? 'on' : '') + '" data-act="rtone" data-tone="' + t.id + '">' + t.label + '</button>').join('') +
        '</div>' +
      '</div>' +

      '<div class="sec-label">응답 시점</div>' +
      '<div class="chips">' + delayOpts.map(d => '<button class="chip ' + (r.delay === d ? 'on' : '') + '" data-act="delay" data-d="' + d + '">' + d + '</button>').join('') + '</div>' +

      '<div class="card" style="margin-top:16px;background:var(--soft);border-color:transparent">' +
        '<div style="display:flex;gap:9px"><span style="color:var(--muted)">' + icon('info', 16) + '</span>' +
        '<p class="small" style="color:var(--ink2)">가격·위치·체험 문의는 자주 묻는 질문으로 인식해 정해진 답을 쓰고, 그 외 댓글은 톤에 맞춰 답합니다. DM 자동 응답은 Threads 공식 API에 권한이 없어 지원하지 않습니다.</p></div>' +
      '</div>' +

      '<h2>샘플 댓글 미리보기<span class="link">' + SAMPLE_COMMENTS.length + '개</span></h2>' +
      '<div class="stack">' + SAMPLE_COMMENTS.map(c => {
        const sent = state.sentReplies.indexOf(c.id) !== -1;
        return '<div class="reply-card">' +
          '<div class="comment"><span class="cmm-av">' + esc(c.initial) + '</span>' +
          '<div><div class="cmm-who">' + esc(c.who) + ' <span style="color:var(--muted2);font-weight:600">· ' + c.at + '</span></div>' +
          '<div class="cmm-txt">' + esc(c.text) + '</div></div></div>' +
          '<div class="reply-preview"><div class="rp-head">' + icon('spark', 12) + '자동 답글 · ' + (TONE_LABEL[r.tone] || '') + ' · ' + FORMALITY_LABEL[state.settings.formality || 'casual'] + '</div>' +
          '<div class="rp-body">' + esc(replyFor(c.intent, r.tone, state.settings.formality)) + '</div></div>' +
          '<div class="reply-actions">' + (sent
            ? '<span class="sent-badge">' + icon('check', 13, 2.4) + '전송 완료</span>'
            : '<button class="btn sm" data-act="send-reply" data-id="' + c.id + '" ' + (r.enabled ? '' : 'disabled') + '>' + icon('send', 13) + '지금 답글 달기</button>') +
          '</div></div>';
      }).join('') + '</div>' +
      '<p class="fine" style="margin-top:16px">데모 · 실제 댓글에 답글을 달지 않습니다.</p>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- 뷰: 요금제 */
  function planCard(p) {
    const now = state.plan === p.id;
    if (p.id === 'trial') {
      return '<div class="plan compact' + (now ? ' pick' : '') + '">' +
        '<div class="row"><div>' +
          '<div class="plan-head"><span class="plan-name">' + p.name + '</span><span class="plan-acc">계정 1개 · 14일</span></div>' +
          '<p class="small" style="margin-top:4px">카드 등록 없이 모든 기능을 써 볼 수 있어요.</p>' +
        '</div>' + (now
          ? '<span class="tag solid">현재</span>'
          : '<button class="btn xs" data-act="choose-plan" data-p="trial">시작</button>') +
        '</div></div>';
    }
    return '<div class="plan' + (now ? ' pick' : '') + '">' +
      (p.badge ? '<span class="plan-badge">' + p.badge + '</span>' : '') +
      '<div class="plan-head"><span class="plan-name">' + p.name + '</span><span class="plan-acc">계정 ' + p.accounts + '개</span></div>' +
      '<div class="plan-price">' + (p.price ? won(p.price) + '<span>원 / 월</span>' : '0<span>원</span>') + '</div>' +
      '<p class="small" style="margin-top:2px">' + p.desc + '</p>' +
      '<ul class="plan-feats">' + p.feats.map(f => '<li>' + icon('check', 13, 2.4) + '<span>' + f + '</span></li>').join('') + '</ul>' +
      (now
        ? '<button class="btn line block" disabled>현재 플랜</button>'
        : '<button class="btn ' + (p.id === 'pro' ? 'primary' : 'line') + ' block" data-act="choose-plan" data-p="' + p.id + '">' + (state.plan === 'trial' ? '이 플랜으로 시작' : '플랜 변경') + '</button>') +
    '</div>';
  }

  function viewPricing() {
    const plan = PLANS[state.plan] || PLANS.trial;
    const left = trialLeftDays();
    return '<div class="page">' +
      '<h1>요금제<span class="sub">계정 수에 맞춰 고르면 됩니다</span></h1>' +
      '<div class="plan-now"><div style="flex:1"><div class="pl">현재 플랜</div><div class="pn">' + esc(plan.name) + '</div>' +
        '<div class="pd">' + (state.plan === 'trial' ? '무료 체험 ' + left + '일 남음 · 카드 등록 없음' : '월 ' + won(plan.price) + '원 · 다음 결제일 12월 17일') + '</div></div>' +
        '<span class="tag solid">' + (state.plan === 'trial' ? 'D-' + left : '사용 중') + '</span></div>' +

      planCard(PLANS.trial) + planCard(PLANS.standard) + planCard(PLANS.pro) + planCard(PLANS.agency) +

      '<div class="card" style="margin-top:16px;background:var(--soft);border-color:transparent">' +
        '<p class="small" style="color:var(--ink2)">모든 플랜에 예약 발행, AI 초안, 댓글 자동 답글이 포함됩니다. 실제 서비스에서는 카드 등록 후 매월 자동 결제되고, 언제든 해지할 수 있습니다.</p></div>' +
      '<p class="fine" style="margin-top:12px">데모 · 플랜을 선택해도 실제 결제는 일어나지 않습니다.</p>' +
      operatorFooter() +
    '</div>';
  }

  /* ---------------------------------------------------------------- 렌더 */
  const VIEWS = {
    login: viewLogin,
    signup: viewSignup,
    connect: viewConnect,
    home: viewHome,
    drafts: viewDrafts,
    calendar: viewCalendar,
    log: viewLog,
    settings: viewSettings,
    replies: viewReplies,
    pricing: viewPricing,
    admin: viewAdmin          // 운영자용 관리자 콘솔(데모 · #/admin 직접 접근 가능)
  };
  const AUTH_VIEWS = { login: 1, signup: 1 };

  function currentView() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    // 관리자 콘솔은 데모라 로그인 전에도 바로 열립니다(실서비스에서는 운영자 권한 검사 필요).
    if (raw === 'admin') return 'admin';
    if (!isLoggedIn()) return raw === 'signup' ? 'signup' : 'login';
    if (AUTH_VIEWS[raw]) return state.onboarded ? 'home' : 'connect';
    if (VIEWS[raw]) return raw;
    return state.onboarded ? 'home' : 'connect';
  }

  function renderTopbar(view) {
    const el = $('#topbar');
    if (!el) return;
    if (view === 'connect' || AUTH_VIEWS[view] || view === 'admin') { el.className = 'topbar hidden'; el.innerHTML = ''; return; }
    const a = activeAccount();
    const unread = state.logs.some(l => l.at > (state.seenLog || 0));
    el.className = 'topbar';
    el.innerHTML = '<div class="brand"><span class="mark">' + markSvg(14) + '</span>ThreadPilot</div>' +
      '<div class="top-actions">' +
      '<button class="icon-btn" data-act="nav" data-to="log" aria-label="알림">' + icon('bell', 21) + (unread ? '<span class="dot"></span>' : '') + '</button>' +
      (a ? '<div class="avatar" style="background:' + a.color + '">' + esc(a.name.slice(0, 1)) + '</div>' : '') +
      '</div>';
  }

  function renderTabbar(view) {
    const el = $('#tabbar');
    if (!el) return;
    if (view === 'connect' || AUTH_VIEWS[view] || view === 'admin') { el.className = 'tabbar hidden'; el.innerHTML = ''; return; }
    const cur = (view === 'pricing' || view === 'replies') ? 'settings' : view;
    const tabs = [['home', '홈', 'home'], ['drafts', '글쓰기', 'spark'], ['calendar', '예약', 'calendar'], ['log', '로그', 'list'], ['settings', '설정', 'sliders']];
    el.className = 'tabbar';
    el.innerHTML = tabs.map(t => '<button class="tab' + (cur === t[0] ? ' on' : '') + '" data-act="nav" data-to="' + t[0] + '">' +
      icon(t[2], 22) + '<span>' + t[1] + '</span></button>').join('');
  }

  function render() {
    const view = currentView();
    if (view === 'log') { state.seenLog = Date.now(); save(); }
    renderTopbar(view);
    const sc = $('#screen');
    const st = sc ? sc.scrollTop : 0;
    if (sc) sc.innerHTML = VIEWS[view]();
    if (sc) sc.scrollTop = st;
    renderTabbar(view);
    syncClock();
  }

  function syncClock() {
    const el = $('#sb-time');
    if (el) { const d = new Date(); el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  }

  function go(v) {
    if (('#/' + v) === location.hash) { render(); return; }
    location.hash = '#/' + v;
  }

  /* ---------------------------------------------------------------- 동작 */
  const BANNED_DEFAULT_TEXT = '';

  function addTopic() {
    const i = $('#topic-input'); if (!i) return;
    const v = i.value.trim(); if (!v) return;
    if (state.settings.topics.indexOf(v) === -1 && state.settings.topics.length < 8) state.settings.topics.push(v);
    i.value = '';
    save(); render();
    toast('주제 추가', v, 'ok');
  }
  function addBan() {
    const i = $('#ban-input'); if (!i) return;
    const v = i.value.trim(); if (!v) return;
    if (state.settings.banned.indexOf(v) === -1) state.settings.banned.push(v);
    i.value = '';
    save(); render();
  }
  function addSlot() {
    const i = $('#slot-input'); if (!i) return;
    const v = i.value; if (!v) return;
    if (state.settings.slots.indexOf(v) === -1 && state.settings.slots.length < 5) {
      state.settings.slots.push(v);
      state.settings.slots.sort();
    }
    save(); render();
  }

  function toggleAuto() {
    state.settings.autoPublish = !state.settings.autoPublish;
    if (state.settings.autoPublish) { ensureFill(true); }
    save(); render();
    toast(state.settings.autoPublish ? '완전 자동 발행 켜짐' : '초안 승인 모드로 바뀜', state.settings.autoPublish ? '이번 주 슬롯을 채웠어요' : null, 'ok');
  }

  function generateDrafts() {
    if (document.body.classList.contains('generating')) return;
    document.body.classList.add('generating');
    state.drafts = [];
    render();
    setTimeout(() => {
      const s = state.settings;
      const topics = shuffle(s.topics.length ? s.topics : ['오늘']).slice(0, 3);
      while (topics.length < 3) topics.push(topics[0]);
      state.drafts = topics.map(t => ({ id: uid('d'), topic: t, tone: s.tone, formality: s.formality, text: compose(t, s.tone), at: Date.now() }));
      document.body.classList.remove('generating');
      save(); render();
      toast('초안 3개를 만들었어요', s.topics[0] + ' · ' + TONE_LABEL[s.tone] + ' · ' + FORMALITY_LABEL[s.formality], 'ok');
    }, 560);
  }

  function copyDraft(id) {
    const d = state.drafts.find(x => x.id === id);
    if (!d) return;
    const done = () => toast('문구를 복사했어요', null, 'ok');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(d.text).then(done, () => toast('복사할 수 없어요'));
    } else { toast('복사할 수 없어요'); }
  }

  function discardDraft(id) {
    state.drafts = state.drafts.filter(d => d.id !== id);
    save(); render();
  }

  function handleAct(act, el) {
    switch (act) {
      case 'nav': go(el.dataset.to); break;
      case 'connect-open': openConnectSheet(); break;
      case 'acct-pick': {
        sheetPick = Number(el.dataset.i) || 0;
        const root = $('#sheet-root');
        root.querySelectorAll('[data-pick]').forEach(v => { v.innerHTML = Number(v.dataset.pick) === sheetPick ? icon('check', 18, 2.2) : ''; });
        break;
      }
      case 'connect-confirm': connectConfirm(); break;
      case 'gen': generateDrafts(); break;
      case 'schedule': openScheduleSheet(el.dataset.id); break;
      case 'slot-pick': {
        pendingSlot = Number(el.dataset.t);
        const list = $('#slot-list');
        if (list) list.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', Number(c.dataset.t) === pendingSlot));
        const inp = $('#custom-at'); if (inp) inp.value = toLocalInput(pendingSlot);
        break;
      }
      case 'schedule-confirm': scheduleConfirm(); break;
      case 'copy': copyDraft(el.dataset.id); break;
      case 'discard': discardDraft(el.dataset.id); break;
      case 'item': openItemSheet(el.dataset.id); break;
      case 'publish-now': publishNow(el.dataset.id); break;
      case 'cancel-item': cancelItem(el.dataset.id); break;
      case 'edit-item': openEditSheet(el.dataset.id); break;
      case 'save-edit': saveEdit(el.dataset.id); break;
      case 'close-sheet': closeSheet(); break;
      case 'prev-week': state.week = (state.week || 0) - 1; save(); render(); break;
      case 'next-week': state.week = (state.week || 0) + 1; save(); render(); break;
      case 'log-filter': logFilter = el.dataset.f; render(); break;
      case 'tone': state.settings.tone = el.dataset.tone; save(); render(); break;
      case 'rtone': state.settings.replies.tone = el.dataset.tone; save(); render(); break;
      case 'formality': {
        const f = el.dataset.f === 'formal' ? 'formal' : 'casual';
        if (state.settings.formality === f) break;
        state.settings.formality = f;
        save(); render();
        toast(FORMALITY_LABEL[f] + '로 바뀜', '새로 만드는 초안·답글부터 적용돼요', 'ok');
        break;
      }
      case 'logout':
        openSheet('<h3>로그아웃할까요?</h3><p class="sh-sub">저장된 설정과 예약은 이 브라우저에 남아 있고, 같은 이메일로 다시 로그인하면 그대로 이어집니다.</p>' +
          '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
          '<button class="btn primary" data-act="logout-confirm">로그아웃</button></div>');
        break;
      case 'logout-confirm': doLogout(); break;
      case 'reset-pw':
        openSheet('<h3>ThreadPilot 비밀번호 찾기</h3>' +
          '<p class="sh-sub">여기서 찾는 건 <b>우리 서비스 로그인 비밀번호</b>예요. 스레드(메타) 계정 비밀번호와는 별개입니다.</p>' +
          '<div class="sheet-body">' +
            '<div class="set-card" style="margin-top:14px">' +
              '<div class="set-row static"><span class="ic" style="background:var(--accent-soft);color:var(--accent)">' + icon('user', 15) + '</span>' +
              '<div><div class="lab" style="font-size:13px">ThreadPilot 계정</div><div class="desc">가입한 이메일로 재설정 링크를 보내는 기능입니다</div></div></div>' +
              '<div class="set-row static"><span class="ic">' + icon('info', 15) + '</span>' +
              '<div><div class="lab" style="font-size:13px;color:var(--warn)">데모 · 실제 재설정 메일은 발송되지 않습니다</div>' +
              '<div class="desc">서버가 없어 메일 발송을 건너뜁니다. 기억이 안 나면 새 이메일로 회원가입해 테스트하세요</div></div></div>' +
            '</div>' +
            '<div class="help-line" style="margin-top:14px">' +
              '<span class="hl-ic">' + icon('info', 14) + '</span>' +
              '<div><p class="hl-t">스레드(메타) 계정 비밀번호를 찾으시나요?</p>' +
              '<a class="ext-link" href="https://accountscenter.instagram.com/password_reset/" target="_blank" rel="noopener noreferrer">메타 계정 복구 페이지로 이동' + icon('right', 12) + '</a>' +
              '<p class="hl-d">그건 우리 서비스가 보관하지 않는 비밀번호라 메타 사이트에서 직접 재설정해야 합니다. 스레드 계정 연결 화면에도 같은 링크가 있습니다.</p></div>' +
            '</div>' +
          '</div>' +
          '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">닫기</button></div>');
        break;
      case 'social': socialLogin(el.dataset.p); break;
      case 'social-continue': socialContinue(el.dataset.p); break;
      case 'delay': state.settings.replies.delay = el.dataset.d; save(); render(); break;
      case 'toggle-replies':
        state.settings.replies.enabled = !state.settings.replies.enabled;
        save(); render();
        toast(state.settings.replies.enabled ? '자동 답글 켜짐' : '자동 답글 꺼짐', null, 'ok');
        break;
      case 'add-topic': addTopic(); break;
      case 'del-topic':
        state.settings.topics = state.settings.topics.filter(t => t !== el.dataset.t);
        if (!state.settings.topics.length) state.settings.topics = ['오늘'];
        save(); render(); break;
      case 'add-ban': addBan(); break;
      case 'del-ban':
        state.settings.banned = state.settings.banned.filter(t => t !== el.dataset.t);
        save(); render(); break;
      case 'add-slot': addSlot(); break;
      case 'del-slot':
        state.settings.slots = state.settings.slots.filter(t => t !== el.dataset.t);
        save(); render(); break;
      case 'per-inc':
        state.settings.perDay = Math.min(5, state.settings.perDay + 1);
        save(); render(); break;
      case 'per-dec':
        state.settings.perDay = Math.max(1, state.settings.perDay - 1);
        save(); render(); break;
      case 'toggle-auto': toggleAuto(); break;
      case 'fill-week':
        ensureFill(true); save(); render();
        toast('이번 주 슬롯을 채웠어요', '빈 시간대만 채웁니다', 'ok');
        break;
      case 'send-reply': {
        const c = SAMPLE_COMMENTS.find(x => x.id === el.dataset.id);
        if (!c) break;
        state.sentReplies.push(c.id);
        addLog('reply', Date.now(), c.who + ' 댓글에 자동 답글 전송', null);
        save(); render();
        toast('답글을 보냈어요', c.who, 'ok');
        break;
      }
      case 'switch-acct': {
        const a = accountById(el.dataset.id);
        if (!a) break;
        state.active = a.id; save(); render();
        toast(a.name + ' 대표 계정으로 설정', null, 'ok');
        break;
      }
      case 'choose-plan': {
        const p = PLANS[el.dataset.p];
        if (!p) break;
        openSheet('<h3>' + p.name + ' 플랜으로 변경</h3>' +
          '<p class="sh-sub">월 ' + won(p.price) + '원 · 계정 ' + p.accounts + '개. 데모에서는 결제가 일어나지 않고 플랜만 바뀝니다.</p>' +
          '<div class="sheet-body"><ul class="plan-feats" style="margin-top:16px">' +
          p.feats.map(f => '<li>' + icon('check', 13, 2.4) + '<span>' + f + '</span></li>').join('') + '</ul></div>' +
          '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
          '<button class="btn primary" data-act="plan-confirm" data-p="' + p.id + '">변경</button></div>');
        break;
      }
      case 'plan-confirm': {
        const p = PLANS[el.dataset.p];
        state.plan = p.id; save(); closeSheet(true); render();
        toast(p.name + ' 플랜으로 바뀌었어요', p.price ? '월 ' + won(p.price) + '원' : '무료', 'ok');
        break;
      }
      case 'adm-toggle': {
        const c = admin.customers.find(x => x.id === el.dataset.id);
        if (!c) break;
        const row = adminRows().find(x => x.id === c.id);
        if (row && row.status === 'expired') {
          toast('무료 체험이 끝났어요', '요금제를 바꿔 주세요', 'warn');
          openAdminPlanSheet(c.id);
          break;
        }
        c.auto = !c.auto;
        adminLog(c.id, 'system', c.auto ? '자동 발행 재개' : '자동 발행 일시정지', c.auto ? 'ok' : 'paused');
        saveAdmin();
        render();
        toast(c.auto ? '자동 발행을 다시 켰어요' : '자동 발행 일시정지', c.name, 'ok');
        break;
      }
      case 'adm-toggle-me': toggleAuto(); break;
      case 'adm-plan': openAdminPlanSheet(el.dataset.id); break;
      case 'adm-plan-pick': {
        const c = admin.customers.find(x => x.id === el.dataset.id);
        const p = el.dataset.plan;
        if (!c || !PLANS[p]) break;
        const wasExpired = c.plan === 'trial' && c.trialEnds && c.trialEnds <= Date.now();
        c.plan = p;
        c.trialEnds = p === 'trial' ? Date.now() + 14 * DAY : null;
        if (p === 'trial' || wasExpired) c.auto = true;   // 만료된 체험을 유료로 바꾸면 발행을 다시 켭니다
        adminLog(c.id, 'system', '요금제를 ' + ADMIN_PLAN_LABEL[p] + '로 바꿨습니다', 'ok');
        saveAdmin();
        closeSheet(true);
        render();
        toast('요금제를 바꿨어요', c.name + ' · ' + ADMIN_PLAN_LABEL[p] + (PLANS[p].price ? ' ' + (PLANS[p].price / 10000) + '만원' : ''), 'ok');
        break;
      }
      case 'adm-logs': openAdminLogSheet(el.dataset.id); break;
      case 'adm-filter': admFilter = el.dataset.f; render(); break;
      case 'adm-retry': {
        const l = admin.logs.find(x => x.id === el.dataset.id);
        if (!l || l.retry !== 'waiting') break;
        l.retry = 'done';
        l.state = 'ok';
        adminLog(l.customerId, 'publish', '재시도 성공 — 대기하던 글이 발행됐습니다', 'ok');
        saveAdmin();
        render();
        toast('재시도 성공', '대기하던 글 1건이 발행됐어요', 'ok');
        break;
      }
      case 'adm-reset':
        openSheet('<h3>시뮬레이션 초기화</h3><p class="sh-sub">데모 고객 5곳과 발행·오류 로그를 처음 상태로 되돌립니다. 내 앱 설정과 예약은 그대로입니다.</p>' +
          '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
          '<button class="btn primary" data-act="adm-reset-confirm">초기화</button></div>');
        break;
      case 'adm-reset-confirm':
        admin = seedAdmin();
        saveAdmin();
        closeSheet(true);
        render();
        toast('초기화했어요', '데모 고객·로그를 처음 상태로', 'ok');
        break;
      case 'reset':
        openSheet('<h3>데모 데이터 초기화</h3><p class="sh-sub">계정 연결, 예약, 로그, 설정이 지워지고 처음 단계로 돌아갑니다. 로그인 상태는 유지됩니다.</p>' +
          '<div class="sheet-actions"><button class="btn line" data-act="close-sheet">취소</button>' +
          '<button class="btn primary" data-act="reset-confirm">초기화</button></div>');
        break;
      case 'reset-confirm': {
        const owner = state.owner, trial = state.trialStartedAt;
        state = defaultState();
        state.owner = owner;
        state.trialStartedAt = trial;
        save(); closeSheet(true);
        location.hash = '#/connect'; render();
        toast('초기화했어요', null, 'ok');
        break;
      }
    }
  }

  /* ---------------------------------------------------------------- 이벤트 */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    handleAct(el.dataset.act, el);
  });

  document.addEventListener('submit', e => {
    const f = e.target;
    if (!f || !f.id) return;
    if (f.id === 'login-form') { e.preventDefault(); doLogin(); }
    else if (f.id === 'signup-form') { e.preventDefault(); doSignup(); }
  });

  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'adm-q') {
      admQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const box = $('#adm-q');
      if (box) { box.focus(); try { box.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
      return;
    }
    if (e.target && (e.target.id === 'login-pass' || e.target.id === 'login-email')) authMsg('');
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const id = e.target && e.target.id;
    if (id === 'topic-input') { e.preventDefault(); addTopic(); }
    else if (id === 'ban-input') { e.preventDefault(); addBan(); }
  });

  window.addEventListener('hashchange', () => {
    closeSheet(true);
    const sc = $('#screen'); if (sc) sc.scrollTop = 0;
    render();
  });

  window.addEventListener('resize', fitDevice);

  function fitDevice() {
    const d = $('#device');
    if (!d) return;
    if (window.innerWidth < 460 || window.innerHeight < 640) { d.style.zoom = ''; d.style.transform = 'none'; return; }
    const s = Math.min(1.1, (window.innerHeight - 56) / 844, (window.innerWidth - 56) / 390);
    // zoom은 레이아웃 단계에서 확대/축소되어 글자가 선명하게 유지됩니다.
    d.style.transform = 'none';
    d.style.zoom = Math.abs(s - 1) < 0.01 ? '' : String(Math.round(s * 1000) / 1000);
  }

  /* ---------------------------------------------------------------- 부팅 */
  load();
  loadAuth();
  loadAdmin();
  if (!location.hash) {
    location.hash = '#/' + (!isLoggedIn() ? 'login' : (state.onboarded ? 'home' : 'connect'));
  }
  if (isLoggedIn()) {
    const u = sessionUser();
    if (u) adoptUser(u);
    processDue(true);
    if (state.onboarded && state.settings.autoPublish) ensureFill(false);
    save();
  }
  render();
  fitDevice();

  setInterval(() => {
    if (!isLoggedIn()) { syncClock(); return; }
    const n = processDue(false);
    if (n > 0) render();
    else syncClock();
  }, 20000);

  // 스크롤 시 상단 경계선
  document.addEventListener('scroll', () => {
    const sc = $('#screen'), tb = $('#topbar');
    if (sc && tb) tb.classList.toggle('scrolled', sc.scrollTop > 4);
  }, true);

  // PWA
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
