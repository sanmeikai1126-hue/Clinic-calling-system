import { AIProvider, AppMode, GeminiResponse } from '../types';
import { generateClinicalNote as generateGemini } from './geminiService';
import OpenAI from 'openai';

// Default OpenAI chat model (user-requested)
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

// Reusing the prompt from geminiService (copying it here to modify for text-based input)
// We could export it from geminiService, but for decoupling let's redefine or import if possible.
// For now, I'll redefine the core prompt but adapt it for text input.

const DERMATOLOGY_PROMPT = `
システムプロンプト：皮膚科カルテ作成アシスタント
背景
あなたは熟練した皮膚科医のカルテ記載を代行するAIです。 以下の「会話ログ」を読み取り、医師が書くような専門的かつ端的なSOAP形式でカルテを出力してください。

重要指示（必ず守ること）
1. 徹底した簡潔さ: 文章で書かず、体言止め、単語の羅列、箇条書きを用いること。「〜しました」「〜と考えられます」などの冗長な語尾は削除する。
2. 専門用語への変換: 患者が話した一般的な部位名や症状表現は、医学的な専門用語に変換して記載すること。（例：肘の内側→肘窩、ブツブツ→丘疹/湿疹、水ぶくれ→水疱）
3. 外用薬の正確性: ステロイドのランクや、混合薬、基剤（軟膏/クリーム/ローション）の区別を文脈から読み取り反映すること。
4. 情報の選別: 雑談や医学的に無関係な会話は削除する。

出力スタイル見本（Tone & Manner）
以下の医師の記載スタイルを模倣してください。

良い例1 S) 日曜に結婚式。生理前にニキビ悪化。初診。 O) 下顎に膿疱性ざ瘡1、炎症性ざ瘡1。面圧処置。鼻・頬に毛穴開大あるがcomedoなし。 A) 顔面ざ瘡 P) 式前のため全顔治療せず、赤ニキビへ点状塗布。式後に範囲拡大可。ベピオや施術の選択肢も提示。

良い例2 S) バー勤務（週4）、素手で食器洗浄。 O) 小児BA・AD既往。眼瞼・口周囲に落屑性紅斑。前頚部に粃糠様鱗屑・褐色沈着。肘窩に軽度苔癬化。手背〜手指に浸潤性紅斑・亀裂・滲出液。 A) AD、職業性手湿疹（左右差あり接触性の要素も考慮） P) 内服・外用開始。1M後再診。難治なら仕事調整指導。

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
S（Subjective） 患者の主訴、現病歴、既往歴。患者の言葉の要点のみを抽出。
O（Objective） 視診・触診所見、検査結果。必ず部位は医学用語に変換すること。
A（Assessment） 診断名、評価。
P（Plan） 処方内容、処置、指導、次回予約。命令形や体言止めで短く記載。
`;

const TRANSCRIPTION_RULES = `
【システム追加指示：文字起こしとJSON出力の厳格なルール】
あなたは上記「皮膚科カルテ作成アシスタント」として振る舞いつつ、以下のデータ構造ルールを厳守してください。

1. **JSON形式の遵守**:
   - 出力は必ず指定されたJSONスキーマのみを返してください。
   - \`transcription\` (会話ログ) と \`soap\` (カルテ要約) の両方が必須です。

2. **文字起こし (transcription) のルール【最重要】**:
   - **逐語記録**: 会話内容は一切要約・書き換え・省略せず、入力されたテキストをそのまま出力してください。
   - **禁止事項**: 文章の整形、言い換え、敬語の統一、フィラー（「えっと」「うん」等）の削除は絶対に禁止です。
   - **話者分離**: 文脈から「医師」と「患者」を明確に区別してください。
   - **多言語対応**: 英語や中国語などの外国語が含まれる場合は、「原文 (日本語訳)」の形式で記述してください。
   - **出力形式**: 各発話は {speaker: "医師" or "患者", text: "発話内容"} のオブジェクト配列で出力。

3. **SOAP作成時の優先順位**:
   - SOAPは要約して構いませんが、transcriptionは絶対に逐語的に出力してください。
   - プロンプト前半の「皮膚科用語変換ルール」「薬剤データベース」を最優先し、医学的に正確なカルテを作成してください。
`;

const SYSTEM_PROMPT = DERMATOLOGY_PROMPT + "\n\n" + TRANSCRIPTION_RULES;

// Helper to convert Base64 to File object (for OpenAI SDK)
const base64ToFile = async (base64: string, mimeType: string, filename: string): Promise<File> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
};

// Helper: Transcribe using OpenAI Whisper
const transcribeWithOpenAI = async (audioFile: File, apiKey: string): Promise<string> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'ja', // Default to Japanese context, but it detects others
        response_format: 'text',
    });
    return response as unknown as string;
};

// Helper: Generate JSON with OpenAI
const generateOpenAI = async (transcript: string, apiKey: string, model: string = DEFAULT_OPENAI_MODEL): Promise<GeminiResponse> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const completion = await openai.chat.completions.create({
        model: model,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `以下の会話ログを元にカルテを作成してください:\n\n${transcript}` }
        ],
        response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content from OpenAI");

    const result = JSON.parse(content);

    // Handle both lowercase (s, o, a, p) and uppercase (S, O, A, P) keys
    // Also handle case where SOAP is at root level vs nested in 'soap' object
    const soapData = result.soap || result.SOAP || result;
    const soap = {
        s: soapData.s || soapData.S || '',
        o: soapData.o || soapData.O || '',
        a: soapData.a || soapData.A || '',
        p: soapData.p || soapData.P || ''
    };

    // Handle transcription: OpenAI may return string instead of array, 
    // or array with different key names (utterance vs text)
    let transcriptionArray: { speaker: string; text: string }[] = [];

    if (Array.isArray(result.transcription)) {
        // Normalize array items: handle both 'text' and 'utterance' keys
        transcriptionArray = result.transcription.map((item: any) => ({
            speaker: item.speaker || '医師',
            text: item.text || item.utterance || item.content || ''
        }));
    } else if (typeof result.transcription === 'string') {
        // Parse string format: "医師: text\n患者: text\n..."
        const lines = result.transcription.split('\n').filter((line: string) => line.trim());
        transcriptionArray = lines.map((line: string) => {
            // Match patterns like "医師:" or "患者:" at the start
            const match = line.match(/^(医師|患者|ドクター|Doctor|Patient)[：:]\s*/i);
            if (match) {
                const speaker = match[1].toLowerCase().includes('doctor') || match[1] === '医師' || match[1] === 'ドクター'
                    ? '医師'
                    : '患者';
                const text = line.substring(match[0].length).trim();
                return { speaker, text };
            }
            // Default to previous speaker or '医師'
            return { speaker: '医師', text: line.trim() };
        });
    }

    // Ensure structure matches GeminiResponse
    return {
        language: result.language || 'ja-JP',
        transcription: transcriptionArray,
        soap: soap,
        usedModel: model
    };
};

export const generateClinicalNote = async (
    audioBase64: string,
    mode: AppMode,
    provider: AIProvider,
    apiKeys: Record<string, string>,
    mimeType: string = 'audio/webm'
): Promise<GeminiResponse> => {
    const providerLabel = provider === AIProvider.OPENAI
        ? `OpenAI (Whisper + ${DEFAULT_OPENAI_MODEL})`
        : 'Gemini (native audio)';
    console.log(`[AI] Routing request to ${providerLabel}`);

    // 1. Gemini (Native Multimodal)
    if (provider === AIProvider.GEMINI) {
        const key = apiKeys[AIProvider.GEMINI];
        if (!key) throw new Error("Gemini API Key is missing");
        return await generateGemini(audioBase64, mode, key, mimeType);
    }

    // 2. Others (Audio -> Whisper -> LLM)
    // All other providers currently rely on OpenAI Whisper for transcription
    const openaiKey = apiKeys[AIProvider.OPENAI];
    if (!openaiKey) {
        throw new Error(`${provider}を使用するには、音声認識のためにOpenAI APIキーも必要です。`);
    }

    // Convert Base64 to File for Whisper
    const extension = mimeType.split('/')[1] || 'webm';
    const audioFile = await base64ToFile(audioBase64, mimeType, `recording.${extension}`);

    // Transcribe
    console.log("Transcribing with OpenAI Whisper...");
    let transcript = await transcribeWithOpenAI(audioFile, openaiKey);
    console.log("Transcription complete:", transcript.substring(0, 50) + "...");

    // Clean up Whisper output: remove speaker labels like 【佐藤】
    transcript = transcript.replace(/【[^】]+】/g, '').trim();

    // Dispatch to LLM
    const targetKey = apiKeys[provider];
    if (!targetKey) throw new Error(`${provider} API Key is missing`);

    switch (provider) {
        case AIProvider.OPENAI:
            return await generateOpenAI(transcript, targetKey, DEFAULT_OPENAI_MODEL);
        default:
            throw new Error("Unknown Provider");
    }
};
