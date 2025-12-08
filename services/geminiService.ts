
import { GoogleGenAI, Type } from "@google/genai";
import { AppMode, GeminiResponse } from '../types';

// ------------------------------------------------------------------
// 1. 皮膚科カルテ作成用 プロンプト (User Provided)
// ------------------------------------------------------------------
// Live Mode用：純粋な文字起こしプロンプト（話者特定付き）
export const LIVE_TRANSCRIPTION_PROMPT = `
**役割**：
あなたは医療現場のリアルタイム文字起こし専門アシスタントです。
医師と患者の会話を聞き取り、正確に文字起こししてください。

**絶対に守る禁止事項**：
- JSONやコードブロック(\`\`\`)は一切出力しないでください
- SOAPノートやカルテは絶対に作成しないでください
- 要約や解釈は不要です
- 会話内容の記録のみに専念してください

**指示**：
1. 聞き取った内容をそのまま文字起こしする
2. **話者分離**: 以下の手がかりを総合的に使って「医師」と「患者」を区別してください
   - **音声の特徴**: 声色、声の高さ、イントネーション、話し方の違いを判別
   - **文脈**: 医療用語や指示を出す側 → 【医師】
   - **文脈**: 症状を訴える側、質問される側 → 【患者】
   - 発言の前に必ず話者を明示してください（例: 【医師】こんにちは）
   - 話者が交代するたびに、必ず新しい行として出力してください
   - 重要: 同じ話者の連続発言でも、自然な区切り（文の終わり）ごとに改行してください
3. 会話の内容を一言一句正確に記録してください
4. **多言語対応**: 英語や中国語などの外国語が含まれる場合は、「原文 (日本語訳)」の形式で記述してください
   - 例: "Yes, it hurts here. (はい、ここが痛みます。)"
5. 聞き取った内容を順次出力してください

**医療用語の認識**：
以下の薬剤名を正確に認識してください：
- ステロイド: デルモベート、マイザー、アンテベート、リンデロン、フルメタ等
- 保湿剤: ヒルドイド、ワセリン、プロペト等
- その他: プロトピック、コレクチム、ゼビアックス等

**重要**：
- あなたは観察者として会話を記録するだけです
- 会話に参加したり、質問に答えたりしないでください
- 文字起こし以外の出力は一切しないでください

**出力形式**：
【医師】（医師の発言内容）
【患者】（患者の発言内容）
【医師】（医師の発言内容）
...
`;


// SOAP生成用：既存の詳細プロンプト
export const DERMATOLOGY_PROMPT = `
システムプロンプト：皮膚科カルテ作成アシスタント (Advanced Version)
背景
あなたは熟練した皮膚科医のカルテ記載を代行するAIです。 患者と医師の会話音声を読み取り、医師が書くような専門的かつ端的なSOAP形式でカルテを出力してください。

重要指示（必ず守ること）
1. 徹底した簡潔さ: 文章で書かず、体言止め、単語の羅列、箇条書きを用いること。
2. 専門用語への変換: 部位や症状は医学用語に変換すること（例：肘の内側→肘窩）。
3. 外用薬の正確性: ステロイドのランクや基剤の種類を正確に記載すること。
4. 情報の選別: 雑談は削除し、医学的に重要な情報のみを残すこと。

各セクションの作成指針（改定版）

【S (Subjective)】
- **患者の言葉のニュアンスを重視**: 堅苦しい書き言葉に変換しすぎず、患者の訴えの「温度感」や「ベクトル」を残すこと。
- **状態のベクトル**: 治療がうまくいっているのか（改善、満足）、うまくいっていないのか（悪化、不満、不安）が伝わるように記載する。
- **具体例**: 「薬が合っていて調子いいです」→「外用良好。調子良い」「全然治らなくて痒い」→「無効。痒み著明。不満あり」

【O (Objective)】
- **視覚的特徴の記述**: 他の医師がカルテを読んだ際に、その皮疹をスケッチ（模写）できる程度に特徴（色、形、大きさ、隆起など）を拾うこと。
- **注意**: 音声から明確に視覚情報（「赤いですね」「1センチくらいですね」「盛り上がってますね」など）が得られた場合のみ記載し、決して幻覚（Hallucination）を起こさないこと。
- **記載例**: 「右前腕に貨幣大の紅斑あり」「境界明瞭な色素斑」「小豆大の丘疹が散在」

【A (Assessment)】
- **期間の記載**: 症状がいつから続いているのか（Duration）を必ず拾って記載すること。
- **記載例**: 「接触皮膚炎（3日前〜）」「慢性湿疹（数ヶ月〜）」

【P (Plan)】
- **処方と疾患の対応付け**: 複数の疾患がある場合、どの薬がどの疾患・部位に対する処方なのか、文脈から判断して明確に紐づけること。
- **不要な情報の削除**: 一般的な疾患概念や治療方針の講釈は不要。その患者に対して具体的に決定したことのみを書く。
- **記載例**: 「顔面：ニキビ→ベピオ、体：湿疹→アンテベート」「内服追加かつ外用継続」

出力スタイル見本（Tone & Manner）
以下の医師の記載スタイルを模倣してください。

良い例1 S) 結婚式控え（日曜）。生理前増悪。外用継続し調子良い（満足）。 O) 下顎に膿疱性ざ瘡1、炎症性ざ瘡1。面圧処置。鼻・頬に毛穴開大あるがcomedoなし。 A) 顔面ざ瘡（数年〜） P) 式前のため面圧のみ。外用継続（赤ニキビへ点状塗布）。

良い例2 S) 手荒れ治らない（不満）。バー勤務（週4）、素手で洗浄。 O) 手背〜手指に浸潤性紅斑・亀裂・滲出液あり。前回より拡大。 A) 進行性指掌角皮症（職業性）。 P) ステロイドランク上げ（アンテベートへ）。綿手袋指導。

用語変換ルール（患者語彙→医学用語）
会話内で以下の表現が出た場合は、対応する医学用語に書き換えてSOAPに記載してください。

【部位変換】
肘の内側、腕の関節 → 肘窩（ちゅうか）
膝の裏 → 膝窩（しっか）
手の甲 → 手背（しゅはい）
手のひら → 手掌（しゅしょう）
足の甲 → 足背（そくはい）
足の裏 → 足底（そくてい）
指の間 → 指間（しかん）
まぶた → 眼瞼（がんけん）
首、首周り → 前頚部・側頚部・項部（うなじ）
背中 → 背部（はいぶ）
お尻 → 臀部（でんぶ）
脇の下 → 腋窩（えきか）

【症状・性状変換】
赤み、赤い → 紅斑（こうはん）
ブツブツ（小さい） → 丘疹（きゅうしん）
膿を持ったニキビ → 膿疱（のうほう）
カサカサ、粉をふく → 落屑（らくせつ）、鱗屑（りんせつ）
じゅくじゅく、汁が出る → びらん、滲出液（しんしゅつえき）
皮が厚くなる、ゴワゴワ → 苔癬化（たいせんか）
ひっかき傷 → 掻破痕（そうはこん）
黒ずみ → 色素沈着
白く抜ける → 色素脱失

皮膚科薬剤・用語データベース
文脈解析の際、以下の用語を優先的に認識・使用してください。

【外用薬：ステロイド（ランク順）】
I群 (Strongest): クロベタゾール（デルモベート）、ジフルプレドナート（ダイアコート）
II群 (Very Strong): モメタゾン（フルメタ）、ベタメタゾンジプロピオン酸エステル（リンデロンDP）、ジフラル（ジフラール）、アンテベート、トプシム
III群 (Strong): ベタメタゾン吉草酸エステル（リンデロンV/VG）、フルオシノロン（フルコート）、デキサメタゾン（ボアラ）、メサデルム
IV群 (Medium): ヒドロコルチゾン（ロコイド）、アルクロメタゾン（アルメタ）、プレドニゾロン（リドメックス）、キンダベート
V群 (Weak): プレドニゾロン（プレドニン）

【外用薬：アトピー・湿疹・保湿】
JAK阻害/PDE4/他: タクロリムス（プロトピック）、デルゴシチニブ（コレクチム）、ジファミラスト（モイゼット）
保湿・血行促進: ヘパリン類似物質（ヒルドイド）、尿素（ウレパール/ケラチナミン）、ワセリン（プロペト）

【外用薬：痤瘡（ニキビ）】
アダパレン（ディフェリン）
過酸化ベンゾイル（ベピオ）
クリンダマイシン・BPO配合（デュアック）
アダパレン・BPO配合（エピデュオ）
オゼノキサシン（ゼビアックス）
ナジフロキサシン（アクアチム）
イブプロフェンピコノール（スタデルム）

【外用薬：真菌（水虫）】
ルリコナゾール（ルリコン）
ラノコナゾール（アスタット）
テルビナフィン（ラミシール）
ケトコナゾール（ニ佐ラール）
アモロルフィン（ペキロン）

【内服薬】
抗ヒスタミン: ビラスチン（ビラノア）、オロパタジン（アレロック）、フェキソフェナジン（アレグラ）、レボセチリジン（ザイザル）、デザレックス、ルパフィン
抗生剤: ドキシサイクリン（ビブラマイシン）、ミノサイクリン（ミノマイシン）、ロキシスロマイシン（ルリッド）、ファロペネム（ファロム）
その他: トラネキサム酸（トランサミン）、ビオチン、漢方（十味敗毒湯、清上防風湯、桂枝茯苓丸、ヨクイニン）

出力フォーマット（SOAP）
S（Subjective） 患者の主訴、状態のベクトル（良/悪）、現病歴。
O（Objective） 視診項目（色・形・大きさ等の視覚的特徴含む）、検査結果。
A（Assessment） 診断名、期間。
P（Plan） 処方（疾患との紐付け）、処置、指導。
`;

// ------------------------------------------------------------------
// 2. 文字起こし・翻訳・出力形式に関する追加ルール
// ------------------------------------------------------------------
const TRANSCRIPTION_RULES = `
【システム追加指示：文字起こしとJSON出力の厳格なルール】

あなたは上記「皮膚科カルテ作成アシスタント」として振る舞いつつ、以下のデータ構造ルールを厳守してください。

1. **JSON形式の遵守**:
   - 出力は必ず指定されたJSONスキーマのみを返してください。
   - \`transcription\` (会話ログ) と \`soap\` (カルテ要約) の両方が必須です。

2. **文字起こし (transcription) のルール**:
   - **話者分離**: 音声の特徴や文脈から「医師」と「患者」を明確に区別してください。話者が交代するたびに、必ず新しいオブジェクトとして配列を分割してください。連続した会話を1つにまとめないでください。
   - **多言語対応**: 英語や中国語などの外国語が含まれる場合は、**必ず**「原文 (日本語訳)」の形式で記述してください。
     - OK例: "Yes, it hurts here. (はい、ここが痛みます。)"
     - OK例: "Xièxie. (ありがとう。)"
   - **逐語記録**: SOAPは要約ですが、文字起こしは会話の正確な記録として、省略せずに記述してください。

3. **SOAP作成時の優先順位**:
   - プロンプト前半の「皮膚科用語変換ルール」「薬剤データベース」を最優先し、医学的に正確なカルテを作成してください。
`;

const SYSTEM_PROMPT_BASE = DERMATOLOGY_PROMPT + "\n\n" + TRANSCRIPTION_RULES;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING, description: "Detected main language code (e.g., ja-JP, en-US)" },
    transcription: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, description: "Identify speaker exactly: '医師' or '患者'. Switch explicitly on turn taking." },
          text: { type: Type.STRING, description: "Transcribed text. MUST use format 'Original Text (Japanese Translation)' for ANY non-Japanese speech." }
        }
      }
    },
    soap: {
      type: Type.OBJECT,
      properties: {
        s: { type: Type.STRING, description: "Subjective" },
        o: { type: Type.STRING, description: "Objective" },
        a: { type: Type.STRING, description: "Assessment" },
        p: { type: Type.STRING, description: "Plan" }
      }
    }
  }
};

// ------------------------------------------------------------------
// Functions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Helper: Retry Logic with Exponential Backoff
// ------------------------------------------------------------------
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  backoff: number = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Retry only on 503 (Service Unavailable) or 429 (Too Many Requests)
    const shouldRetry =
      retries > 0 &&
      (error?.message?.includes("503") ||
        error?.message?.includes("429") ||
        error?.status === 503 ||
        error?.status === 429);

    if (shouldRetry) {
      console.warn(`API Error ${error.status || 'unknown'}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoff, backoff);
    }
    throw error;
  }
}

export const generateClinicalNote = async (
  audioBase64: string,
  mode: AppMode,
  apiKey: string,
  mimeType: string = 'audio/webm' // Default to webm for recordings
): Promise<GeminiResponse> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  let finalSystemPrompt = SYSTEM_PROMPT_BASE;

  // 翻訳モードの場合、プロンプトに追加指示を加えて強調する
  if (mode === AppMode.TRANSLATE) {
    finalSystemPrompt += `
    
    【重要設定：翻訳モード ON】
    現在、外国語診療モードです。以下のルールを**強制**します：
    1. すべての外国語発言に対して、直後に (日本語訳) を付記すること。
       NG: "Hello, doctor."
       OK: "Hello, doctor. (こんにちは、先生。)"
    
    2. 話者分離を細かく行うこと。
       医師が日本語、患者が英語、といった切り替えを正確に配列として分割して表現すること。
    `;
  }




  // Multi-model fallback: Try 2.5 Flash -> 2.0 Flash -> 1.5 Flash
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`Attempting with model: ${model}`);

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: audioBase64
                }
              }
            ]
          },
          config: {
            systemInstruction: finalSystemPrompt,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.2,
          }
        });
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No response generated from Gemini.");

      console.log(`✓ Success with model: ${model}`);
      const result = JSON.parse(jsonText) as GeminiResponse;
      result.usedModel = model; // Track which model was used
      return result;

    } catch (error: any) {
      console.error(`Failed with ${model}:`, error.message || error);
      lastError = error;

      // If it's not a 503/429 error, don't try other models
      const shouldFallback =
        error?.message?.includes("503") ||
        error?.message?.includes("429") ||
        error?.status === 503 ||
        error?.status === 429;

      if (!shouldFallback) {
        console.error("Non-retryable error, stopping fallback");
        throw error;
      }

      // If this is the last model, throw the error
      if (model === models[models.length - 1]) {
        console.error("All models failed");
        throw error;
      }

      console.log(`Falling back to next model...`);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("All models failed");
};

// Lightweight Text Translation using Gemini 2.5 Flash
export const translateText = async (text: string, targetLang: string, apiKey: string): Promise<string> => {
  if (!text.trim()) return "";
  if (!apiKey) return text; // Fallback if no key

  const ai = new GoogleGenAI({ apiKey });

  const langMap: Record<string, string> = {
    'ja': 'Japanese',
    'en': 'English',
    'zh': 'Chinese',
    'ko': 'Korean',
    'vi': 'Vietnamese',
    'ne': 'Nepali',
    'tl': 'Filipino (Tagalog)',
    'id': 'Indonesian',
    'th': 'Thai',
    'pt': 'Portuguese',
    'es': 'Spanish',
    'my': 'Burmese'
  };

  const targetLangName = langMap[targetLang] || targetLang;

  try {
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following text to ${targetLangName}. Only return the translated text, nothing else.
      Text: "${text}"`,
        config: {
          temperature: 0.1
        }
      });
    });

    return response.text?.trim() || "";
  } catch (e) {
    console.error("Translation failed:", e);
    return text; // Fallback to original
  }
};
