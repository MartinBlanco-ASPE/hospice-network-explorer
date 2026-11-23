"""Shared, transparent rules for the two-layer classification prototype (home health and hospice kept separate).

Layer 1 (tag layer) is built from structured fields in each study's builder. This module holds the citation-layer rules.

issue_statement(text): the surveyor's own summary sentence of the deficient practice -- the first sentence (after any
  requirement preamble such as 'It is required that ...') that carries a deficiency cue ('failed to', 'did not',
  'had not ensured', 'no evidence', 'was not' ...), with boilerplate trimmed ('Based on ...,', 'it was determined that',
  'This deficient practice ...', 'resulting in ...') and long parenthetical definitions removed.
classification text: the statement after the cue, with the 'did not have evidence (in the record) that' framing and the
  sample description ('in 2 of 14 records reviewed ...') removed, so neither the writing style nor the sample wording
  drives the labels.
failure type: what kind of failure (12 types + other); multi-label, primary by a fixed priority (specific before generic).
care area: what the failure is about (26 areas + other); multi-label, primary = the area named first in the classification
  text (the object of the failure), ties broken by list order. Actor words (staff, therapist, RN) are not objects.
These are keyword/regex working definitions, validated on a held-out read sample -- not semantic or clinical validation.
"""
import re

ABBR = re.compile(r'\b(Pts?|Dr|No|Mr|Mrs|Ms|St|vs|Inc|approx|Rm|Ext|Jr|Sr|M\.R|MR|R\.N|L\.P\.N|e\.g|i\.e|etc)\.', re.I)
SENT = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"(\[])|\n{1,}(?=\s*(?:\d+[.)]|[-*•]|[A-Z]))')
STRONG = re.compile(r"\b(?:failed|fails|fail)\s+to\b|\bfailure\s+to\b|\b(?:did|does|do)\s+not\b|\b(?:had|has|have)\s+not\b"
                    r"|\bnot\s+(?:been\s+)?ensured?\b|\bno\s+(?:evidence|documentation|documented)\b|\black(?:ed|s|ing)?\b(?:\s+of)?|\babsence of\b", re.I)
WEAK = re.compile(r"\b(?:was|were|is|are)\s+not\b(?!\s+met)|\bwithout (?:a |an |the )?(?:physician'?s? |practitioner'?s? )?(?:orders?|documentation|evidence|consent|signatures?|authoriz\w*)\b|\bmissing\b|\bincomplete\b|\bnever\b|\bunable to\b"
                  r"|\bnot (?:\w+ ){0,2}(?:measurable|individuali[sz]ed|specific|current|complete|accurate|available|signed|dated|documented|done|completed|provided|followed|updated|revised|reviewed|maintained|implemented)\b|\b\d+ days? (?:late|after)\b", re.I)
PREAMBLE = re.compile(r"^\W*(?:it is required|the (?:hospice|hha|agency|organization) (?:must|shall|is required)|standard\s*:|condition of participation"
                      r"|this (?:standard|element|condition|requirement|regulation) (?:is|was) not met|§?\s*4(?:18|84)\.\d+)", re.I)
LEAD = re.compile(r"^.*?\bit was (?:determined|found|revealed|noted|observed|identified)(?: that)?\s+|^.*?\bthe (?:surveyor|survey team) (?:determined|found|noted|observed)(?: that)?\s+", re.I | re.S)
HEADER = re.compile(r"^\W*(?:observed in [^.]{0,40}?(?:review|interview|observation|tour|visit)s?\.\s*|(?:upon|during) (?:the )?(?:patient |client |clinical |medical )?(?:record|chart|file|personnel file|hr file|document) review,?\s*|upon (?:home visit )?observation,?\s*)", re.I)
BASED = re.compile(r"^\W*(?:based on|upon|through|during)\b[^,]{0,160},\s*", re.I)
TAIL = re.compile(r"\s*(?:,\s*)?(?:this (?:deficient practice|failure|practice|deficiency|lack|has|had|affected|could|resulted)|which (?:has|had|could|may|resulted)|resulting in"
                  r"|creating (?:the|a) (?:risk|potential)|that (?:has|had|could) (?:the )?potential|findings? (?:include|included|are)\b|\(\s*refer to|the findings were)\b.*$", re.I | re.S)
PAREN = re.compile(r'\s*\([^()]{30,}\)')
NUM = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split())}
NUMW = r'(?:\d{1,4}|' + '|'.join(NUM) + r')'
SCALE = re.compile(r'\b(' + NUMW + r')\b(?:\s*\([^)]{0,80}\))?\s+(?:out\s+)?of\s+(?:the\s+)?(' + NUMW + r')\b', re.I)
SAMPLE = re.compile(r'(?:\b(?:in|for|of)\s+)?\b' + NUMW + r'\b(?:\s*\([^)]{0,80}\))?\s+(?:out\s+)?of\s+(?:the\s+)?(?:total\s+(?:of\s+)?)?' + NUMW +
                    r'\b(?:\s*\([^)]{0,80}\))?(?:\s+(?!that\b|which\b|did\b|had\b|was\b|were\b)[\w/-]+){0,5}?\s+(?:reviewed|observed|conducted|sampled|interviewed|visited|records?|patients?|charts?|files?|visits?|samples?|residents?|employees?|personnel|staff)\b(?:\s+(?:reviewed|observed|conducted|sampled))?', re.I)
SAMPLE2 = re.compile(r'\b(?:clinical |medical |patient |personnel )?(?:records?|charts?|files?) reviewed\b|\bsampled patients?\b|\bhome visits? (?:conducted|observed|made)\b', re.I)
FRAME = re.compile(r"\b(?:did|does)\s+not\s+have\s+(?:evidence\s+)?(?:documentation\s+)?(?:evidence\s+)?(?:in\s+the\s+(?:patient|clinical|medical|personnel)\s+(?:record|file|chart)s?\s+)?(?:that|of)\b|\bthere\s+(?:was|were|is)\s+no\s+(?:evidence|documentation)\s+(?:that|of)?\b|\bno\s+evidence\s+(?:that|of)\b", re.I)


def clean(text):
    text = re.sub(r'(?<![.!?:;])[ \t]*\n[ \t]*(?![ \t]*(?:\d+[.)]|[-*•]))', ' ', text[:5000])   # rejoin wrapped lines
    return ABBR.sub(lambda m: m.group(1), text)


def sentences(text):
    return [s.strip() for s in SENT.split(clean(text)) if s and s.strip()]


def _trim(s, facility):
    s = re.sub(r'^.*?(?:is|was)\s+not\s+met\s+as\s+evidenced\s+by\s*:?\s*', '', s, flags=re.I | re.S)
    s = HEADER.sub('', s)
    s = LEAD.sub('', s)
    m = BASED.match(s)
    if m and not (STRONG.search(m.group(0)) or WEAK.search(m.group(0))):   # never cut into the statement itself
        s = s[m.end():]
    s = TAIL.sub('', s)
    s = PAREN.sub('', s).strip(' ,;:-')
    if facility and len(facility) >= 5:
        s = re.sub(re.escape(facility), '[AGENCY]', s, flags=re.I)
    return re.sub(r'\s+', ' ', s)[:450]


def issue_statement(text, facility=None):
    """Return (statement, cue_strength): the earliest cue sentence among the first three findings sentences, else the
    first strong-cue sentence anywhere, else the first weak-cue sentence; ('', 'none') when no cue exists."""
    sents = [s for s in sentences(text) if not (PREAMBLE.match(s) and not re.search(r'evidenced by\s*:?\s*\S', s, re.I))]
    order = []
    for i, s in enumerate(sents):
        if STRONG.search(s):
            order.append((0 if i < 3 else 1, i, s, 'strong'))
        elif WEAK.search(s):
            order.append((0 if i < 3 else 2, i, s, 'weak'))
    for _, i, s, strength in sorted(order):
        if not re.search(r'[.!?]["\')]?$', s) and i + 1 < len(sents) and len(s) < 300:   # requirement wording cut by a list
            s = s + ' ' + sents[i + 1]
        st = _trim(s, facility)
        if len(st) >= 12:
            return st, strength
    for s in sents:                                   # no cue: first substantive findings sentence (e.g. 'it was noted ...')
        st = _trim(s, facility)
        if len(st.split()) >= 8 and not PREAMBLE.match(st):
            return st, 'fallback'
    return '', 'none'


def scale(text):
    m = SCALE.search(text)
    if not m:
        return '', ''
    a, b = (NUM.get(x.lower(), x) for x in m.groups())
    a, b = int(a), int(b)
    return (a, b) if 0 < a <= b else ('', '')


def classification_text(statement):
    """Predicate after the cue, without evidence framing or sample description."""
    parts = re.split(r"\b(?:failed|fails|fail)\s+to\b|\bfailure to\b|\b(?:did|does)\s+not\s+ensure\b|\bhad not ensured\b", statement, maxsplit=1, flags=re.I)
    t = parts[-1] if len(parts) > 1 else statement
    framed = bool(FRAME.search(t))
    t = FRAME.sub(' ', t)
    t = SAMPLE.sub(' ', t)
    t = SAMPLE2.sub(' ', t)
    return re.sub(r'\s+', ' ', t).strip(), framed


# ---------------------------------------------------------------- failure type (what kind of failure); order = priority
FAILURE = [
    ('rights_information', 'Patient rights, notices or information not provided',
     r"\brights?\b|\bnotice\b|\bwritten (?:information|instructions?|notice|schedules?)|\bprivacy\b|\bconfidential\w*|\bcomplaints?\b|\bgrievance\w*|\badvance directives?\b|\bhotline\b|\bconsent\b|\binformed of\b|\bin writing\b|\bmistreatment\b|\babuse\b"),
    ('not_timely', 'Not done on time or at the required frequency',
     r"\btimel(?:y|iness)\b|\bwithin\s+(?:\w+\s+){0,3}(?:hours?|days?|business days|weeks?|months?)\b|\bevery\s+(?:\d+|\w+)\s+(?:days?|weeks?|months?)\b|\bat least (?:every|once|annually|weekly|monthly)\b|\b(?:late|delay(?:ed)?|overdue|prior to|in advance of)\b|\bannual(?:ly)?\b|\b(?:24|48)[- ]hours?\b|\b\d+[- ]day\b|\bafter (?:the )?expiration\b|\b\d+ days? (?:late|after)\b"),
    ('not_as_ordered', 'Not done as ordered or as the plan of care specified',
     r"\bas ordered\b|\bordered by (?:the |a )?(?:physician|practitioner)|\bper (?:the )?(?:physician'?s?|practitioner'?s?|md'?s?)?\s*orders?\b|\bin accordance with [^.;]{0,40}\b(?:orders?|plan of care|poc|care plans?)\b|\b(?:according to|per|followed?|following|consistent with|as (?:written|specified) (?:in|on)) (?:the )?(?:patient'?s )?(?:written )?(?:aide )?(?:plan of care|poc|care plans?|orders?)\b|\bfrequency (?:ordered|in the plan)|\bordered (?:visits?|frequency|services?|treatments?)\b|\bnot ordered\b|\bassigned on the\b"),
    ('orders_authorization', 'Orders, signatures or consent not obtained',
     r"\bobtain(?:ed|ing)?\b[^.;]{0,40}\b(?:orders?|signatures?|consents?|authoriz\w*|certifications?)\b|\borders?\b[^.;]{0,30}\bobtained\b|\b(?:signed|unsigned|authenticat\w*|countersign\w*)\b|\bverbal orders?\b|\bwithout (?:a |an |the )?(?:physician'?s? |practitioner'?s? )?orders?\b|\bcertif(?:y|ication) of (?:the )?terminal illness\b|\borders? (?:were|was) (?:entered|recorded|received)"),
    ('program_policy', 'Program, policy or oversight not established, maintained or effective',
     r"\b(?:develop|establish|maintain|implement|enforce|adopt)\w*\b[^.;]{0,50}\b(?:program|policy|policies|system|process|procedures?|protocols?)\b|\bqapi\b|\bquality (?:assessment|assurance)\b|\bperformance improvement\b|\bgoverning body\b|\boversight\b|\bagency-wide\b|\bdesignat\w* (?:an? |the )?(?:individual|administrator|alternate|physician|person)"),
    ('staff_competency', 'Staff qualification, training, competency or supervision not ensured',
     r"\bqualif\w*|\bcompeten\w*|\btrain(?:ed|ing)?\b|\borient\w*|\bsupervis\w*|\blicensure\b|\bbackground checks?|\bcriminal\b|\bin-?service|\bskills? (?:check|validation|competency)|\bjob description"),
    ('not_communicated', 'Not communicated, reported or coordinated',
     r"\bnotif\w*|\balert\w*\b|\binform(?:ed|ing)?\b(?! consent)|\breport(?:ed|ing)? (?:to|the|any)\b|\bcommunicat\w*|\bcoordinat\w*|\bcontact(?:ed)?\b|\bshar(?:e|ed|ing)\b|\bdiscuss\w*\b|\bconsult(?:ed|ation)? with\b"),
    ('not_reviewed_updated', 'Not reviewed, revised or updated',
     r"\breview(?:ed|ing)?\b(?! of the| by)|\brevis\w*|\bupdat\w*|\breassess\w*|\bre-?evaluat\w*|\breconcil\w*"),
    ('not_documented', 'Not documented',
     r"\bdocument\w*|\brecord(?:ed)? (?:in|on)\b|\bnot (?:noted|charted)\b|\bentered into\b"),
    ('missing_content', 'Required content missing or inaccurate (plan, assessment, record, form)',
     r"\binclud\w*\b|\bcontain\w*\b|\baddress(?:ed|es)?\b|\bindividuali[sz]\w*|\bpatient[- ]specific\b|\bmeasurable\b|\baccurate(?:ly)?\b|\bincomplete\b|\bcomplete and accurate\b|\bdelineat\w*|\bnon-?specific\b|\ball (?:pertinent|required|current|necessary)\b|\bspecif(?:y|ied|ic)\b|\bdetailed\b|\bclear\b"),
    ('incorrect_practice', 'Done incorrectly or not to accepted standards',
     r"\bproper(?:ly)?\b|\bcorrect(?:ly)?\b|\bappropriate(?:ly)?\b|\baccepted (?:standards|practice)|\bstandards? of (?:practice|care)\b|\bfollow(?:ed)? (?:its|their|the|agency|established|accepted)?\s*(?:own )?(?:policy|policies|procedures?|protocols?|infection control)|\btechnique\b|\bsafe(?:ly|ty)?\b|\bsanitar\w*|\bclean\w*|\bstor(?:e|ed|age)\b|\bexpired\b|\blabel\w*|\bdispos\w*|\bsecur\w*|\bfree from\b|\bprotect\w*"),
    ('not_done', 'Not done or not provided',
     r"\bprovid\w*|\bconduct\w*|\bperform\w*|\bcomplet\w*|\bdeliver\w*|\bfurnish\w*|\bimplement\w*|\bcarr(?:y|ied) out\b|\badminister\w*|\bmake (?:a |the )?visits?\b|\bvisits? (?:were|was) not\b|\bassess(?:ed)?\b|\bevaluat\w*|\binitiat\w*|\bmade available\b|\beducat\w*|\bteach\w*|\binstruct\w*|\bscreen\w*|\bmonitor\w*|\bassur\w*|\bpromot\w*|\bplan(?:ned)? (?:the|for)\b|\bmet\b|\bensur\w*|\bhas developed\b|\bdeveloped\b|\bestablished\b|\boffer\w*"),
]
FAILURE_RE = [(c, l, re.compile(p, re.I)) for c, l, p in FAILURE]

# ---------------------------------------------------------------- care area (what the failure is about); actors are not objects
CARE = [
    ('qapi_quality', 'QAPI and quality data', r"\bqapi\b|\bquality (?:assessment|assurance|improvement|program|data|indicators?)\b|\bperformance improvement\b|\bpips?\b|\badverse (?:patient )?events?\b"),
    ('governance_admin', 'Governance, administration, contracts and legal compliance', r"\bgoverning (?:body|board)\b|\badministrator\b|\badministrat(?:ion|ive)\b|\bclinical manager\b|\bdirector of (?:nursing|patient care)\b|\bcontracts?\b|\bagreements?\b|\b(?:under )?arrangements?\b|\bownership\b|\bstate (?:law|licens\w*|regulations?)\b|\bdisclos\w*|\bavailable (?:24|on a 24)"),
    ('oasis_reporting', 'OASIS data reporting', r"\boasis\b[^.;]{0,40}\b(?:transmi\w*|submi\w*|encod\w*|accura\w*|errors?|data)\b|\b(?:transmi\w*|submi\w*|encod\w*)\b[^.;]{0,40}\boasis\b"),
    ('medications', 'Medications, drugs and pharmacy', r"\bmedicat\w*|\bdrugs?\b|\bprescri\w*|\bpharmac\w*|\bdos(?:e|es|age|ing)\b|\bmar\b|\bcontrolled substances?\b|\bnarcotic\w*|\bopioid\w*|\binsulin\b|\bmorphine\b|\bcomfort kits?|\bemergency kits?"),
    ('wound_skin', 'Wounds, pressure injuries and skin', r"\bwounds?\b|\bpressure (?:ulcer|injur|sore)\w*|\bskin\b|\bdressings?\b|\bdecubit\w*|\bulcers?\b"),
    ('infection', 'Infection prevention practice and program', r"\binfecti\w*|\bhand ?hygiene|\bhand ?wash\w*|\bgloves?\b|\bppe\b|\bpersonal protective|\bmasks?\b|\bsanitiz\w*|\bdisinfect\w*|\bbag technique|\bprecautions?\b|\bisolation\b|\bvaccin\w*|\bimmuniz\w*|\bcovid\w*|\btuberculosis\b|\bTB\b|\bsterile\b|\bcommunicable\b"),
    ('pain_symptoms', 'Pain and symptom management', r"\bpain\b|\bsymptoms?\b|\bcomfort\b(?! kit)|\bnausea\b|\bdyspnea\b|\bshortness of breath\b|\bagitation\b|\bconstipation\b|\bpalliat\w*"),
    ('falls_safety', 'Falls, safety, abuse and emergencies', r"\bfalls?\b|\bsafety\b|\binjur\w*|\bhazard\w*|\bfire\b|\bemergenc\w*(?! kit)|\bdisaster\b|\babuse\b|\bneglect\b|\bmistreat\w*|\bexploitation\b|\brestraint\w*"),
    ('devices_equipment', 'Devices, equipment and supplies', r"\bcatheters?\b|\bfoley\b|\bostom\w*|\bfeeding tubes?\b|\bg-?tubes?\b|\bpeg\b|\bintravenous\b|\b(?:iv|picc)\b|\boxygen\b|\bequipment\b|\bdme\b|\bsupplies\b|\bdevices?\b|\bwheelchairs?\b|\bhospital beds?\b|\bglucometers?\b|\bdrains?\b"),
    ('vital_signs_monitoring', 'Vital signs, weights and clinical parameters', r"\bvital signs?\b|\bblood pressures?\b|\bweights?\b|\bpulse\b|\btemperatures?\b|\bparameters?\b|\bblood (?:sugars?|glucose)\b|\bglucose\b|\bo2 sat\w*|\boxygen saturation"),
    ('nutrition_hydration', 'Nutrition, diet and hydration', r"\bnutrition\w*|\bdiet(?:ary)?\b(?! counsel)|\bhydrat\w*|\bfluids?\b|\bmeals?\b|\bfeeding\b"),
    ('aide_services', 'Aide and homemaker services', r"\baides?\b|\bchhas?\b|\bhomemakers?\b|\bpersonal care\b|\bbath\w*\b|\bwritten (?:patient )?care instructions"),
    ('therapy_services', 'Therapy and social work services', r"\bphysical therapy\b|\boccupational therapy\b|\bspeech(?:-language)? (?:therapy|pathology)\b|\b(?:pt|ot|slp|st) (?:visits?|services?|evaluations?)\b|\btherapy (?:visits?|services?)\b|\bsocial (?:work|services)\b|\bmsw\b|\bpsychosocial\b"),
    ('hospice_idg_services', 'Hospice IDG, counseling, bereavement, spiritual and volunteer services', r"\bidg\b|\bidt\b|\binterdisciplinary (?:group|team)\b|\bbereavement\b|\bspiritual\b|\bchaplain\w*|\bcounsel\w*|\bvolunteers?\b"),
    ('inpatient_facility', 'Inpatient, respite and facility-resident care', r"\binpatient\b|\brespite\b|\bgeneral inpatient\b|\bgip\b|\bnursing (?:facility|home)s?\b|\bsnf\b|\bicf\w*|\bassisted living\b|\bfacility residents?\b|\bresidents?\b|\bpatient rooms?\b|\bphysical environment\b|\bboard and care\b"),
    ('eligibility_election', 'Hospice eligibility, election and certification', r"\belection\b|\bterminal(?:ly)? ill\w*|\bprognosis\b|\blife expectancy\b|\bcertification of (?:the )?terminal|\bface-to-face\b|\bf2f\b|\brevocation\b|\bhospice benefit\b"),
    ('discharge_transfer', 'Discharge, transfer and transitions', r"\bdischarg\w*|\btransfer\w*|\btransition\w*"),
    ('assessment', 'Assessment and OASIS assessment content', r"\bassessments?\b|\bassess(?:ed)?\b|\boasis\b|\bevaluations?\b|\bstart of care\b|\bresumption of care\b|\breassessment\b"),
    ('plan_of_care', 'Plan of care content and revision', r"\bplans? of care\b|\bplan (?:the )?(?:patient'?s )?care\b|\bgoals?\b|\bpoc\b|\bcare plans?\b|\bplan of treatment\b|\binterdisciplinary plan\b|\bbereavement plan\b"),
    ('orders_physician', 'Orders and physician/practitioner role', r"\borders?\b|\bphysicians?\b|\bpractitioners?\b|\bmedical director\b|\battending\b"),
    ('care_coordination', 'Care coordination and communication', r"\bcoordinat\w*|\bcase conferences?\b|\bcommunicat\w*|\bshar(?:e|ed|ing) information\b"),
    ('visits_services', 'Visits, service frequency and availability', r"\bvisits?\b|\bfrequenc\w*|\bmissed\b|\bschedul\w*|\bservices?\b|\b24[- ]hours?\b|\bavailab\w*"),
    ('patient_education', 'Patient and caregiver education', r"\beducat\w*|\bteach\w*|\binstruct\w*|\bcaregiver training\b"),
    ('rights_information', 'Patient rights, notices, complaints and confidentiality', r"\brights?\b|\bnotices?\b|\bconsent\b|\bcomplaints?\b|\bgrievance\w*|\badvance directives?\b|\bprivacy\b|\bconfidential\w*|\bhotline\b|\binformation\b|\bin writing\b"),
    ('records_documentation', 'Clinical records and documentation', r"\bclinical records?\b|\bmedical records?\b|\bpatient records?\b|\bdocumentation\b|\bclinical notes?\b|\bvisit notes?\b|\bsignatures?\b|\bauthenticat\w*|\bforms?\b|\brecords?\b"),
    ('staff_personnel', 'Staff qualifications, training, supervision and personnel', r"\bpersonnel (?:files?|records?|qualif\w*)\b|\bsupervis\w*|\bprimary source verification\b|\bverification of (?:licens|certif)\w*|\bstaff (?:files?|qualif\w*|training|competen\w*|members? (?:files|qualif))|\bqualif\w*|\bcompeten\w*|\btraining\b|\borientation\b|\blicens\w*|\bbackground checks?\b|\bcriminal\b|\bhealth screen\w*|\bjob descriptions?\b|\bin-?service"),
]
CARE_RE = [(c, l, re.compile(p, re.I)) for c, l, p in CARE]
FAILURE_LABEL = {c: l for c, l, _ in FAILURE}
CARE_LABEL = {c: l for c, l, _ in CARE}


def classify(statement):
    """Return dict: failure_primary, failures, care_primary, cares, framed (evidence-framing flag), text used."""
    t, framed = classification_text(statement)
    f = [c for c, _, r in FAILURE_RE if r.search(t)]
    pos = []
    for k, (c, _, r) in enumerate(CARE_RE):
        m = r.search(t)
        if m:
            pos.append((m.start(), k, c))
    subject = re.split(r"\b(?:failed|fails|fail)\s+to\b|\bdid not\b|\bhad not\b", statement, maxsplit=1, flags=re.I)[0]
    if re.search(r"\bgoverning (?:body|board)\b", subject, re.I):
        pos.append((-1, 0, 'governance_admin'))
    elif re.search(r"\bqapi\b|\bquality assessment\b", subject, re.I):
        pos.append((-1, 0, 'qapi_quality'))
    if not pos:                                       # nothing named after the cue: use the whole statement
        whole = SAMPLE2.sub(' ', SAMPLE.sub(' ', FRAME.sub(' ', statement)))
        for k, (c, _, r) in enumerate(CARE_RE):
            m = r.search(whole)
            if m:
                pos.append((m.start(), k, c))
    a = [c for _, _, c in sorted(pos, key=lambda x: (x[1]))]
    primary = min(pos)[2] if pos else 'other'
    if not f and framed:                              # 'no evidence that <requirement>' with no other cue: requirement not shown to be met
        f = ['not_done']
    return {'failure_primary': f[0] if f else 'other', 'failures': f, 'care_primary': primary, 'cares': a, 'framed': framed, 'text': t}


QUOTE = re.compile(r'\b(?:stated|said|explained|reported that|indicated that|verbalized)\b', re.I)


def confidence(statement, cue):
    """high: a strong cue statement that names the agency/hospice or uses the evidence framing; low: weak/fallback cue,
    interview quotes, or no statement."""
    if not statement or cue in ('none', 'fallback'):
        return 'low'
    if cue == 'weak' or QUOTE.search(statement):
        return 'low'
    return 'high'
