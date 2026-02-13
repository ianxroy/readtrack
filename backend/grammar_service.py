import calamancy
import spacy
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import language_tool_python
from symspellpy import SymSpell, Verbosity
import pkg_resources
import re
import os
from langdetect import detect, LangDetectException
import nltk
from cefrpy import CEFRSpaCyAnalyzer, CEFRLevel

from google import genai
client = None
model_name = "gemini-flash-lite-latest"

try:
    nltk.data.find('corpora/wordnet.zip')
except LookupError:
    try:
        nltk.download('wordnet')
        nltk.download('omw-1.4')
    except Exception as e:
        print(f"Error downloading WordNet: {e}")
from nltk.corpus import wordnet

router = APIRouter()

try:
    english_tool = language_tool_python.LanguageTool('en-US')
    print("English grammar tool loaded")
except Exception as e:
    print(f"Error loading English grammar tool: {e}")
    english_tool = None

try:
    nlp_en = spacy.load("en_core_web_sm")
    print("English spaCy model loaded")
except Exception as e:
    print(f"Error loading English spaCy model: {e}")
    nlp_en = None

try:
    nlp_tl = calamancy.load("tl_calamancy_md-0.2.0")
    print("Tagalog model loaded")
except Exception as e:
    print(f"Error loading Tagalog model: {e}")
    nlp_tl = None

try:
    cefr_analyzer = CEFRSpaCyAnalyzer()
    print("CEFR Analyzer loaded")
except Exception as e:
    print(f"Error loading CEFR Analyzer: {e}")
    cefr_analyzer = None

sym_spell = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
try:
    dictionary_path = pkg_resources.resource_filename("symspellpy", "frequency_dictionary_en_82_765.txt")
    sym_spell.load_dictionary(dictionary_path, term_index=0, count_index=1)
    print("Spell checker loaded")
except Exception as e:
    print(f"Error loading spell checker: {e}")

class GrammarCheckRequest(BaseModel):
    text: str
    language: Optional[str] = None
    gemini_api_key: Optional[str] = None

class GrammarIssue(BaseModel):
    type: str
    message: str
    offset: int
    length: int
    replacements: List[str]
    context: str
    severity: str
    rule_id: Optional[str] = None

class GrammarCheckResponse(BaseModel):
    text: str
    language: str
    detected_language: str
    issues: List[GrammarIssue]
    issue_count: int
    suggestions_count: int
    corrected_text: Optional[str] = None
    ai_overall_feedback: Optional[str] = None

class DefinitionRequest(BaseModel):
    word: str
    language: Optional[str] = 'en'
    context: Optional[str] = None
    gemini_api_key: Optional[str] = None

class DefinitionResponse(BaseModel):
    word: str
    definitions: List[str]
    synonyms: List[str]
    examples: List[str]
    cefr: Optional[str] = None
    part_of_speech: Optional[str] = None

class SpellCheckResponse(BaseModel):
    original: str
    corrected: str
    has_errors: bool
    suggestions: List[str] = []

class AutoCorrectResponse(BaseModel):
    original: str
    corrected: str
    changes_count: int
    changes: List[dict] = []

def detect_language(text: str) -> str:

    if not text or len(text.strip()) < 10:
        return 'en'

    try:
        detected = detect(text)

        if detected == 'tl':
            return 'tl'
        elif detected == 'en':
            return 'en'
        else:

            return 'en'
    except LangDetectException:

        return 'en'

@router.post("/api/grammar/check", response_model=GrammarCheckResponse)
async def check_grammar(request: GrammarCheckRequest):

    language = request.language if request.language else detect_language(request.text)
    detected_lang = language

    if language == "en":
        result = await check_english_grammar(request.text)
    elif language == "tl":
        result = await check_tagalog_grammar(request.text, request.gemini_api_key)
    else:
        raise HTTPException(status_code=400, detail="Unsupported language. Use 'en' or 'tl'.")

    result.detected_language = detected_lang

    if request.gemini_api_key:
        result = await enhance_with_context_aware_ai(result, request.gemini_api_key, request.text)

    return result

async def check_english_grammar(text: str) -> GrammarCheckResponse:

    if not english_tool:
        raise HTTPException(status_code=500, detail="English grammar tool not available")

    try:
        matches = english_tool.check(text)
        issues = []

        for match in matches:

            issue_type = "grammar"
            if hasattr(match, 'category'):
                category_lower = match.category.lower() if match.category else ""

                if any(word in category_lower for word in ["typo", "misspelling", "spell"]):
                    issue_type = "spelling"
                elif "punctuation" in category_lower:
                    issue_type = "punctuation"
                elif "style" in category_lower:
                    issue_type = "style"
                else:
                    issue_type = "grammar"

            context = ""
            if hasattr(match, 'context'):
                context = str(match.context) if match.context else text[max(0, match.offset - 20):min(len(text), match.offset + match.error_length + 20)]
            else:
                context = text[max(0, match.offset - 20):min(len(text), match.offset + match.error_length + 20)]

            issue = GrammarIssue(
                type=issue_type,
                message=match.message,
                offset=match.offset,
                length=match.error_length,
                replacements=match.replacements[:5] if match.replacements else [],
                context=context,
                severity=get_severity(match),
                rule_id=match.rule_id if hasattr(match, 'rule_id') else None
            )
            issues.append(issue)

        corrected_text = apply_corrections(text, issues)

        return GrammarCheckResponse(
            text=text,
            language="en",
            detected_language="en",
            issues=issues,
            issue_count=len(issues),
            suggestions_count=sum(len(i.replacements) for i in issues),
            corrected_text=corrected_text
        )

    except Exception as e:
        import traceback
        error_details = f"Grammar check failed: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in check_english_grammar: {error_details}")
        raise HTTPException(status_code=500, detail=f"Grammar check failed: {str(e)}")

def get_severity(match):

    category = match.category.lower() if hasattr(match, 'category') and match.category else ""

    if "typo" in category or "grammar" in category or "misspelling" in category:
        return "error"
    elif "style" in category or "misc" in category:
        return "warning"
    else:
        return "info"

async def check_tagalog_grammar(text: str, gemini_api_key: Optional[str] = None) -> GrammarCheckResponse:

    if not nlp_tl:
        raise HTTPException(status_code=500, detail="Tagalog model not available")

    try:
        doc = nlp_tl(text)
        issues = []

        issues.extend(check_repeated_spaces(text))

        issues.extend(check_repeated_words(doc, text))

        issues.extend(check_capitalization(doc, text))

        issues.extend(check_proper_noun_capitalization(doc, text))

        issues.extend(check_pronoun_agreement(doc, text))

        issues.extend(check_ng_vs_nang(doc, text))

        marker_issues = check_tagalog_markers(doc)
        if gemini_api_key and marker_issues:
            marker_issues = await verify_tagalog_markers_with_ai(marker_issues, text, gemini_api_key)
        issues.extend(marker_issues)

        issues.extend(check_tagalog_spelling(doc, text))

        issues.extend(check_punctuation(doc, text))

        issues.sort(key=lambda x: x.offset)

        return GrammarCheckResponse(
            text=text,
            language="tl",
            detected_language="tl",
            issues=issues,
            issue_count=len(issues),
            suggestions_count=sum(len(i.replacements) for i in issues),
            corrected_text=None
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grammar check failed: {str(e)}")

def check_repeated_spaces(text: str):

    issues = []

    matches = list(re.finditer(r' {2,}', text))

    if matches:

        total_spaces = sum(len(m.group()) - 1 for m in matches)
        total_occurrences = len(matches)

        for i, match in enumerate(matches):
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 10)
            context = text[start:end]

            if i == 0:
                message = f"May {total_occurrences} na lugar na may sobrang espasyo (total {total_spaces} extra spaces)."
            else:
                message = f"Sobrang espasyo (repeated space)"

            issues.append(GrammarIssue(
                type="style",
                message=message,
                offset=match.start(),
                length=len(match.group()),
                replacements=[" "],
                context=context,
                severity="error",
                rule_id="REPEATED_SPACES_GROUP"
            ))

    return issues

def check_repeated_words(doc, text):

    issues = []
    tokens = [token for token in doc if not token.is_punct]

    for i in range(len(tokens) - 1):
        if tokens[i].text.lower() == tokens[i + 1].text.lower() and len(tokens[i].text) > 2:
            issues.append(GrammarIssue(
                type="style",
                message=f"Repeated word: '{tokens[i].text}'",
                offset=tokens[i].idx,
                length=tokens[i + 1].idx + len(tokens[i + 1].text) - tokens[i].idx,
                replacements=[tokens[i].text],
                context=text[max(0, tokens[i].idx - 20):min(len(text), tokens[i].idx + 40)],
                severity="warning",
                rule_id="REPEATED_WORDS"
            ))

    return issues

def check_capitalization(doc, text):

    issues = []
    sentences = list(doc.sents)

    for sent in sentences:
        sent_text = sent.text.strip()
        if sent_text and len(sent_text) > 0 and sent_text[0].islower():

            issues.append(GrammarIssue(
                type="grammar",
                message="Ang simula ng pangungusap ay dapat nakamalaking titik",
                offset=sent.start_char,
                length=1,
                replacements=[sent_text[0].upper() + sent_text[1:] if len(sent_text) > 1 else sent_text[0].upper()],
                context=sent_text[:50],
                severity="error",
                rule_id="SENTENCE_CAPITALIZATION"
            ))

    return issues

def check_proper_noun_capitalization(doc, text):

    issues = []
    flagged_positions = set()

    filipino_names = ["juan", "maria", "pedro", "jose", "ana", "rosa", "carlos", "luis"]
    filipino_places = ["manila", "quezon", "cebu", "davao", "maynila", "baguio", "makati", "pasig", "taguig"]

    for token in doc:
        text_lower = token.text.lower()

        if token.idx in flagged_positions:
            continue

        if text_lower in filipino_names or text_lower in filipino_places:
            if token.text[0].islower():
                issues.append(GrammarIssue(
                    type="grammar",
                    message=f"Ang '{token.text}' ay pangalan kaya dapat nakamalaking titik",
                    offset=token.idx,
                    length=len(token.text),
                    replacements=[token.text.capitalize()],
                    context=text[max(0, token.idx - 20):min(len(text), token.idx + 40)],
                    severity="error",
                    rule_id="PROPER_NOUN_CAPITALIZATION"
                ))
                flagged_positions.add(token.idx)

        elif token.i > 0:
            prev_token = doc[token.i - 1]
            if prev_token.text.lower() in ["si", "ni"] and token.text[0].islower():
                issues.append(GrammarIssue(
                    type="grammar",
                    message=f"Ang salita pagkatapos ng '{prev_token.text}' ay pangalan kaya dapat nakamalaking titik",
                    offset=token.idx,
                    length=len(token.text),
                    replacements=[token.text.capitalize()],
                    context=text[max(0, token.idx - 20):min(len(text), token.idx + 40)],
                    severity="error",
                    rule_id="NAME_AFTER_SI_NI"
                ))
                flagged_positions.add(token.idx)

    return issues
async def verify_tagalog_markers_with_ai(issues: List[GrammarIssue], text: str, gemini_api_key: str) -> List[GrammarIssue]:

    try:
        from google import genai
        client = genai.Client(api_key=gemini_api_key)
        model_name = "gemini-flash-lite-latest"

        verified_issues = []

        for issue in issues:

            if issue.rule_id not in ["MARKER_NG_USAGE", "MARKER_SA_USAGE"]:
                verified_issues.append(issue)
                continue

            try:

                issue_text = text[issue.offset:issue.offset + issue.length]

                context_start = max(0, issue.offset - 100)
                context_end = min(len(text), issue.offset + issue.length + 100)
                context = text[context_start:context_end]

                verification_prompt = f

                response = client.models.generate_content(
                    model=model_name,
                    contents=verification_prompt
                )
                ai_answer = response.text.strip().lower()

                if 'incorrect' in ai_answer or 'mali' in ai_answer or 'wrong' in ai_answer:
                    verified_issues.append(issue)

            except Exception as e:
                print(f"AI verification error for issue: {e}")

                pass

        return verified_issues

    except Exception as e:
        print(f"Marker AI verification failed: {e}")

        return issues
def check_tagalog_markers(doc):

    issues = []

    for i, token in enumerate(doc):

        if token.text.lower() == "ang" and i < len(doc) - 1:
            next_token = doc[i + 1]
            if next_token.text.lower() == "ang":
                issues.append(GrammarIssue(
                    type="grammar",
                    message="Dalawang 'ang' na magkasunod. Alisin ang isa.",
                    offset=token.idx,
                    length=len(token.text) + 1 + len(next_token.text),
                    replacements=["ang"],
                    context=doc[max(0, i - 2):min(len(doc), i + 3)].text,
                    severity="error",
                    rule_id="DUPLICATE_MARKER"
                ))

    return issues

def check_tagalog_spelling(doc, text):

    issues = []

    common_errors = {
        "kase": "kasi",
        "piro": "pero",
        "nung": "noong",
        "lng": "lang",
        "mganda": "maganda",
        "dto": "dito",
        "jan": "diyan",
        "dun": "doon",
        "pra": "para",
        "ung": "ang",
        "yung": "iyon",
        "nman": "naman",
        "khit": "kahit",
        "sbhin": "sabihin"
    }

    for token in doc:
        if token.text.lower() in common_errors:
            issues.append(GrammarIssue(
                type="spelling",
                message=f"Maling baybay: '{token.text}' ay dapat '{common_errors[token.text.lower()]}'",
                offset=token.idx,
                length=len(token.text),
                replacements=[common_errors[token.text.lower()]],
                context=text[max(0, token.idx - 20):min(len(text), token.idx + 40)],
                severity="error",
                rule_id="TAGALOG_SPELLING"
            ))

    return issues

def check_punctuation(doc, text):

    issues = []

    sentences = list(doc.sents)
    for sent in sentences:
        sent_text = sent.text.strip()
        if sent_text and sent_text[-1] not in ['.', '!', '?', ':', ';']:
            issues.append(GrammarIssue(
                type="punctuation",
                message="Ang pangungusap ay walang wastong bantas sa dulo",
                offset=sent.end_char - 1,
                length=1,
                replacements=[sent_text[-1] + '.'],
                context=sent_text[-30:],
                severity="warning",
                rule_id="MISSING_PUNCTUATION"
            ))

    for match in re.finditer(r'\s+([.,!?;:])', text):
        issues.append(GrammarIssue(
            type="punctuation",
            message="Walang dapat na espasyo bago ang bantas",
            offset=match.start(),
            length=match.end() - match.start(),
            replacements=[match.group(1)],
            context=text[max(0, match.start() - 20):min(len(text), match.end() + 20)],
            severity="warning",
            rule_id="SPACE_BEFORE_PUNCTUATION"
        ))

    return issues

def check_pronoun_agreement(doc, text: str) -> List[GrammarIssue]:

    issues = []
    pronouns = {
        'sya': 'singular',
        'siya': 'singular',
        'si': 'singular_marker',
        'ni': 'singular_marker',
        'sila': 'plural',
        'sina': 'plural_marker'
    }

    tokens_list = list(doc)

    for i, token in enumerate(tokens_list):
        token_lower = token.text.lower()

        if token_lower in ['sya', 'siya']:

            for j in range(max(0, i - 10), i):
                prev_token = tokens_list[j]

                if prev_token.text.lower() == 'mga' and j + 1 < len(tokens_list):

                    issues.append(GrammarIssue(
                        type="grammar",
                        message=f"Ang '{token.text}' ay para sa singular. Ang 'mga' ay plural, kaya dapat 'sila'.",
                        offset=token.idx,
                        length=len(token.text),
                        replacements=['sila'],
                        context=text[max(0, token.idx - 30):min(len(text), token.idx + 50)],
                        severity="error",
                        rule_id="PRONOUN_AGREEMENT_SINGULAR_PLURAL"
                    ))
                    break

        elif token_lower == 'sila':

            found_plural_marker = False
            found_singular_subject = False

            for j in range(max(0, i - 12), i):
                prev_token = tokens_list[j]

                if prev_token.text.lower() == 'mga':
                    found_plural_marker = True
                    break

                if prev_token.text.lower() in ['si', 'ni']:
                    found_singular_subject = True

            if found_singular_subject and not found_plural_marker:
                issues.append(GrammarIssue(
                    type="grammar",
                    message="Ang 'sila' ay para sa plural. Para sa singular, gamitin ang 'sya' o 'siya'.",
                    offset=token.idx,
                    length=len(token.text),
                    replacements=['siya'],
                    context=text[max(0, token.idx - 30):min(len(text), token.idx + 50)],
                    severity="error",
                    rule_id="PRONOUN_AGREEMENT_PLURAL_SINGULAR"
                ))

    return issues

def check_ng_vs_nang(doc, text: str) -> List[GrammarIssue]:

    issues = []
    tokens_list = list(doc)

    adverbs = {
        'mabilis', 'mabagal', 'maingat', 'madali', 'mahirap', 'malayo', 'malapit',
        'maaga', 'huli', 'malinaw', 'maipot', 'maalon', 'mabuti', 'masama', 'malakas',
        'mahina', 'malaki', 'maliit', 'mataba', 'payat', 'malambot', 'matigas', 'mainit',
        'malamig', 'maaraw', 'umuulan'
    }

    verbs_root = {
        'kumain', 'uminom', 'matulog', 'gumawa', 'magbasa', 'magsulat', 'maglaro',
        'tumakbo', 'lumakad', 'bumangon', 'bumisita', 'magpunta', 'dumating',
        'pumasa', 'bumigo', 'mag-aral', 'magtrabaho', 'magrelax', 'maghanda'
    }

    for i, token in enumerate(tokens_list):
        token_lower = token.text.lower()

        if token_lower in ['ng', 'nang']:

            if i + 1 < len(tokens_list):
                next_token = tokens_list[i + 1]
                next_token_lower = next_token.text.lower()
                next_pos = next_token.pos_

                if token_lower == 'ng':

                    if next_pos in ['VERB', 'ADJ'] or next_token_lower in adverbs or next_token_lower in verbs_root:

                        issues.append(GrammarIssue(
                            type="grammar",
                            message=f"Maaaring dapat 'nang' dito, hindi 'ng'. Ang '{next_token.text}' ay isang action/adjective.",
                            offset=token.idx,
                            length=len(token.text),
                            replacements=['nang'],
                            context=text[max(0, token.idx - 30):min(len(text), token.idx + 50)],
                            severity="warning",
                            rule_id="NG_NANG_CONFUSION_NG_SHOULD_BE_NANG"
                        ))

                elif token_lower == 'nang':

                    common_nouns = {
                        'bata', 'tao', 'babae', 'lalaki', 'paaralan', 'bahay', 'mesa',
                        'libro', 'pen', 'sasakyan', 'ibon', 'alahas', 'damit', 'sapatos',
                        'pagkain', 'inumin', 'buwan', 'araw', 'oras', 'taon'
                    }

                    if next_token_lower in common_nouns:

                        issues.append(GrammarIssue(
                            type="grammar",
                            message=f"Maaaring dapat 'ng' dito, hindi 'nang'. Ang '{next_token.text}' ay isang pangalan.",
                            offset=token.idx,
                            length=len(token.text),
                            replacements=['ng'],
                            context=text[max(0, token.idx - 30):min(len(text), token.idx + 50)],
                            severity="warning",
                            rule_id="NG_NANG_CONFUSION_NANG_SHOULD_BE_NG"
                        ))

    return issues

def apply_corrections(text: str, issues: List[GrammarIssue]) -> str:

    corrected = text

    sorted_issues = sorted(
        [i for i in issues if i.replacements and i.severity == "error"],
        key=lambda x: x.offset,
        reverse=True
    )

    for issue in sorted_issues:
        start = issue.offset
        end = issue.offset + issue.length
        if issue.replacements:
            corrected = corrected[:start] + issue.replacements[0] + corrected[end:]

    return corrected

@router.post("/api/grammar/spell-check", response_model=SpellCheckResponse)
async def spell_check(request: GrammarCheckRequest):

    if request.language == "en":
        suggestions = sym_spell.lookup_compound(request.text, max_edit_distance=2)

        if suggestions and suggestions[0].term != request.text:
            all_suggestions = sym_spell.lookup(request.text, Verbosity.ALL, max_edit_distance=2)
            suggestion_list = [s.term for s in all_suggestions[:5]]

            return SpellCheckResponse(
                original=request.text,
                corrected=suggestions[0].term,
                has_errors=True,
                suggestions=suggestion_list
            )

        return SpellCheckResponse(
            original=request.text,
            corrected=request.text,
            has_errors=False,
            suggestions=[]
        )

    elif request.language == "tl":

        doc = nlp_tl(request.text) if nlp_tl else None
        if not doc:
            raise HTTPException(status_code=500, detail="Tagalog model not available")

        issues = check_tagalog_spelling(doc, request.text)

        if issues:
            corrected = apply_corrections(request.text, issues)
            return SpellCheckResponse(
                original=request.text,
                corrected=corrected,
                has_errors=True,
                suggestions=[i.replacements[0] for i in issues if i.replacements]
            )

        return SpellCheckResponse(
            original=request.text,
            corrected=request.text,
            has_errors=False,
            suggestions=[]
        )

    raise HTTPException(status_code=400, detail="Unsupported language")

@router.post("/api/grammar/auto-correct", response_model=AutoCorrectResponse)
async def auto_correct(request: GrammarCheckRequest):

    check_result = await check_grammar(request)

    changes = []
    for issue in check_result.issues:
        if issue.replacements and issue.severity == "error":
            changes.append({
                "type": issue.type,
                "original": request.text[issue.offset:issue.offset + issue.length],
                "corrected": issue.replacements[0],
                "message": issue.message
            })

    return AutoCorrectResponse(
        original=request.text,
        corrected=check_result.corrected_text or request.text,
        changes_count=len(changes),
        changes=changes
    )

@router.get("/api/grammar/health")
async def health():

    return {
        "status": "healthy",
        "english_available": english_tool is not None and nlp_en is not None,
        "tagalog_available": nlp_tl is not None,
        "spell_checker_available": sym_spell is not None
    }

@router.get("/api/grammar/languages")
async def get_supported_languages():

    return {
        "languages": [
            {
                "code": "en",
                "name": "English",
                "available": english_tool is not None
            },
            {
                "code": "tl",
                "name": "Tagalog/Filipino",
                "available": nlp_tl is not None
            }
        ]
    }

async def enhance_with_context_aware_ai(result: GrammarCheckResponse, gemini_api_key: str, original_text: str) -> GrammarCheckResponse:

    try:
        from google import genai
        client = genai.Client(api_key=gemini_api_key)
        model_name = "gemini-flash-lite-latest"

        language_name = "English" if result.language == "en" else "Filipino/Tagalog"

        priority_issues = [
            issue for issue in result.issues
            if issue.severity == "error" or issue.type in ["spelling", "grammar"]
        ]

        if not priority_issues:
            return result

        for issue in priority_issues[:10]:
            try:
                error_text = original_text[issue.offset:issue.offset + issue.length]

                context_start = max(0, issue.offset - 50)
                context_end = min(len(original_text), issue.offset + issue.length + 50)
                context = original_text[context_start:context_end]

                prompt = f

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                ai_response = response.text.strip()

                if "CORRECTION:" in ai_response and "EXPLANATION:" in ai_response:
                    correction_part = ai_response.split("EXPLANATION:")[0].replace("CORRECTION:", "").strip()
                    explanation_part = ai_response.split("EXPLANATION:")[1].strip()

                    issue.ai_suggestion = correction_part
                    issue.ai_explanation = explanation_part

                    if correction_part:
                        if issue.replacements:
                            issue.replacements[0] = correction_part
                        else:
                            issue.replacements = [correction_part]

            except Exception as e:
                print(f"AI context enhancement failed for issue: {e}")
                continue

        if len(priority_issues) > 2:
            try:
                feedback_prompt = f

                feedback_response = client.models.generate_content(
                    model=model_name,
                    contents=feedback_prompt
                )
                result.ai_overall_feedback = feedback_response.text.strip()
            except Exception as e:
                print(f"AI overall feedback failed: {e}")

    except Exception as e:
        print(f"AI context-aware enhancement error: {e}")

    return result

async def enhance_spelling_with_ai(result: GrammarCheckResponse, gemini_api_key: str, original_text: str) -> GrammarCheckResponse:

    try:
        from google import genai
        client = genai.Client(api_key=gemini_api_key)
        model_name = "gemini-flash-lite-latest"

        language_name = "English" if result.language == "en" else "Filipino/Tagalog"

        spelling_issues = [
            issue for issue in result.issues
            if any(keyword in issue.type.lower() for keyword in ["spelling", "misspelling", "typo", "spell"])
            or (issue.rule_id and "SPELL" in issue.rule_id.upper())
            or (issue.rule_id and "TYPO" in issue.rule_id.upper())
        ]

        if not spelling_issues:
            return result

        for issue in spelling_issues:
            try:
                error_word = original_text[issue.offset:issue.offset + issue.length]
                context_before = original_text[max(0, issue.offset - 30):issue.offset]
                context_after = original_text[issue.offset + issue.length:min(len(original_text), issue.offset + issue.length + 30)]

                prompt = f

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                ai_response = response.text.strip()

                if "CORRECTION:" in ai_response and "EXPLANATION:" in ai_response:
                    correction_part = ai_response.split("EXPLANATION:")[0].replace("CORRECTION:", "").strip()
                    explanation_part = ai_response.split("EXPLANATION:")[1].strip()

                    issue.ai_suggestion = correction_part
                    issue.ai_explanation = explanation_part

                    if correction_part and correction_part not in issue.replacements:
                        issue.replacements.insert(0, correction_part)

            except Exception as e:
                print(f"AI enhancement failed for individual issue: {e}")
                continue

        if len(spelling_issues) > 2:
            try:
                feedback_prompt = f

                feedback_response = client.models.generate_content(
                    model=model_name,
                    contents=feedback_prompt
                )
                result.ai_overall_feedback = feedback_response.text.strip()
            except Exception as e:
                print(f"AI overall feedback failed: {e}")

    except Exception as e:
        print(f"AI spelling enhancement error: {e}")

    return result

class GeminiEnhancedRequest(BaseModel):
    text: str
    language: str = "en"
    gemini_api_key: str

class GeminiEnhancedIssue(BaseModel):
    type: str
    message: str
    offset: int
    length: int
    replacements: List[str]
    context: str
    severity: str
    rule_id: Optional[str] = None
    ai_explanation: Optional[str] = None
    ai_suggestion: Optional[str] = None

class GeminiEnhancedResponse(BaseModel):
    text: str
    language: str
    issues: List[GeminiEnhancedIssue]
    issue_count: int
    suggestions_count: int
    corrected_text: Optional[str] = None
    ai_overall_feedback: Optional[str] = None

@router.post("/api/grammar/check-enhanced", response_model=GeminiEnhancedResponse)
async def check_grammar_enhanced(request: GeminiEnhancedRequest):

    basic_check = await check_grammar(GrammarCheckRequest(
        text=request.text,
        language=request.language
    ))

    enhanced_issues = []

    if basic_check.issues:
        try:
            from google import genai
            client = genai.Client(api_key=request.gemini_api_key)
            model_name = 'gemini-flash-lite-latest'

            for issue in basic_check.issues[:5]:
                error_text = request.text[issue.offset:issue.offset + issue.length]

                prompt = f

                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    import json
                    ai_response = json.loads(response.text.strip().replace('```json', '').replace('```', ''))

                    enhanced_issues.append(GeminiEnhancedIssue(
                        type=issue.type,
                        message=issue.message,
                        offset=issue.offset,
                        length=issue.length,
                        replacements=issue.replacements,
                        context=issue.context,
                        severity=issue.severity,
                        rule_id=issue.rule_id,
                        ai_explanation=ai_response.get('explanation', issue.message),
                        ai_suggestion=ai_response.get('suggestion', issue.replacements[0] if issue.replacements else '')
                    ))
                except Exception as e:

                    enhanced_issues.append(GeminiEnhancedIssue(
                        type=issue.type,
                        message=issue.message,
                        offset=issue.offset,
                        length=issue.length,
                        replacements=issue.replacements,
                        context=issue.context,
                        severity=issue.severity,
                        rule_id=issue.rule_id
                    ))

            for issue in basic_check.issues[5:]:
                enhanced_issues.append(GeminiEnhancedIssue(
                    type=issue.type,
                    message=issue.message,
                    offset=issue.offset,
                    length=issue.length,
                    replacements=issue.replacements,
                    context=issue.context,
                    severity=issue.severity,
                    rule_id=issue.rule_id
                ))

            overall_prompt = f

            overall_response = client.models.generate_content(
                model=model_name,
                contents=overall_prompt
            )
            ai_feedback = overall_response.text.strip()

        except Exception as e:
            print(f"Gemini enhancement error: {e}")

            enhanced_issues = [GeminiEnhancedIssue(**issue.dict()) for issue in basic_check.issues]
            ai_feedback = None

    return GeminiEnhancedResponse(
        text=request.text,
        language=request.language,
        issues=enhanced_issues,
        issue_count=len(enhanced_issues),
        suggestions_count=sum(len(i.replacements) for i in enhanced_issues),
        corrected_text=basic_check.corrected_text,
        ai_overall_feedback=ai_feedback
    )

@router.post("/api/grammar/definition", response_model=DefinitionResponse)
async def get_word_definition(request: DefinitionRequest):
    word = request.word.lower()
    definitions = []
    synonyms = set()
    examples = []
    cefr_level = None
    primary_pos = None

    api_key = request.gemini_api_key or os.getenv('GEMINI_API_KEY', '')

    detected_language = request.language
    try:

        if request.context:
            detected_language = detect(request.context)
        else:

            detected_language = detect(request.word)
        print(f"🔍 Language auto-detected: '{detected_language}' (from word/context)")
    except LangDetectException:

        detected_language = request.language
        print(f"🔍 Language detection failed, using passed language: '{detected_language}'")

    print(f"🔍 Definition request: word='{request.word}', language='{request.language}', detected_language='{detected_language}', has_api_key={bool(api_key)}, api_key_length={len(api_key) if api_key else 0}")

    if detected_language == 'tl' and api_key:
        print(f"🇵🇭 Processing Filipino word: {request.word}")
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            model_name = 'gemini-flash-lite-latest'

            context_text = f" sa konteksto ng: \"{request.context}\"" if request.context else ""
            prompt = f

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            result_text = response.text.strip()

            lines = result_text.split('\n')
            for line in lines:
                if line.startswith('POS:'):
                    primary_pos = line.replace('POS:', '').strip().lower()
                elif line.startswith('Definition:'):
                    definitions.append(line.replace('Definition:', '').strip())
                elif line.startswith('Example:'):
                    examples.append(line.replace('Example:', '').strip())
                elif line.startswith('Synonyms:'):
                    syn_text = line.replace('Synonyms:', '').strip()
                    if syn_text.lower() != 'wala':
                        synonyms = set([s.strip() for s in syn_text.split(',') if s.strip()])

            result = DefinitionResponse(
                word=request.word,
                definitions=definitions if definitions else ["Kahulugan ay hindi makita."],
                synonyms=list(synonyms)[:5],
                examples=examples[:1],
                cefr=None,
                part_of_speech=primary_pos
            )
            print(f"✅ Filipino definition returned: {len(definitions)} definitions, POS={primary_pos}")
            return result
        except Exception as e:
            print(f"❌ Error fetching Filipino definition: {e}")
            import traceback
            traceback.print_exc()
            return DefinitionResponse(
                word=request.word,
                definitions=["Hindi makuha ang kahulugan."],
                synonyms=[],
                examples=[],
                cefr=None,
                part_of_speech=None
            )

    print(f"🇺🇸 Processing English word: {request.word}")
    try:

        if cefr_analyzer and nlp_en:
            doc = nlp_en(word)
            results = cefr_analyzer.analize_doc(doc)
            if results and len(results) > 0:

                level_float = results[0][3]
                if level_float:

                    cefr_level = CEFRLevel(round(level_float)).name

        synsets = wordnet.synsets(word)

        if request.context and api_key and synsets:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                model_name = 'gemini-flash-lite-latest'

                prompt = f

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                result_text = response.text.strip()

                lines = result_text.split('\n')
                for line in lines:
                    if line.startswith('POS:'):
                        primary_pos = line.replace('POS:', '').strip().lower()
                    elif line.startswith('Definition:'):
                        definitions.append(line.replace('Definition:', '').strip())
                    elif line.startswith('Example:'):
                        examples.append(line.replace('Example:', '').strip())
                    elif line.startswith('Synonyms:'):
                        syn_text = line.replace('Synonyms:', '').strip()
                        if syn_text.lower() != 'none':
                            synonyms = set([s.strip() for s in syn_text.split(',') if s.strip()])

                if definitions:
                    return DefinitionResponse(
                        word=request.word,
                        definitions=definitions,
                        synonyms=list(synonyms)[:5],
                        examples=examples[:1],
                        cefr=cefr_level,
                        part_of_speech=primary_pos
                    )
            except Exception as e:
                print(f"Error with context-aware definition: {e}")

        if synsets:

            def synset_priority(s):

                if word in ['are', 'is', 'am', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had']:
                    return 0 if s.pos() == 'v' else 1
                return 0

            synsets.sort(key=synset_priority)

            pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adj', 'r': 'adv', 's': 'adj'}

            best_syn = synsets[0]
            primary_pos = pos_map.get(best_syn.pos(), best_syn.pos())

            for syn in synsets[:3]:
                if syn.definition():
                    pos = pos_map.get(syn.pos(), syn.pos())

                    clean_def = syn.definition().capitalize()
                    definitions.append(f"({pos}) {clean_def}")
                for lemma in syn.lemmas():
                    if lemma.name().lower() != word:
                        synonyms.add(lemma.name().replace('_', ' '))
                if syn.examples():

                    for ex in syn.examples()[:1]:
                        examples.append(ex.capitalize() + ".")

            return DefinitionResponse(
                word=request.word,
                definitions=definitions,
                synonyms=list(synonyms)[:5],
                examples=examples[:3],
                cefr=cefr_level,
                part_of_speech=primary_pos
            )
        elif nlp_en:

            doc = nlp_en(word)
            if doc and len(doc) > 0:
                token = doc[0]
                if token.pos_ == 'PROPN' or token.pos_ == 'NOUN':
                    return DefinitionResponse(
                        word=request.word,
                        definitions=["Proper noun or name."],
                        synonyms=[],
                        examples=[],
                        cefr=cefr_level,
                        part_of_speech="noun"
                    )
    except Exception as e:
        print(f"Error fetching definition for {word}: {e}")

    return DefinitionResponse(
        word=request.word,
        definitions=[],
        synonyms=[],
        examples=[],
        cefr=cefr_level,
        part_of_speech=None
    )

