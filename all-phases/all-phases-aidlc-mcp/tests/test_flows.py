"""Tests for full and abbreviated AI-DLC flows."""
import json
import tempfile
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from aidlc_mcp.server import (
    get_next_phase, get_flow_type, detect_project_state, has_existing_code,
    PHASE_SEQUENCE_FULL, PHASE_SEQUENCE_ABBREVIATED,
    start_project, get_next_phase_tool, update_phase, get_prompt
)
from aidlc_mcp.prompts import PROMPTS


# --- Phase Sequence Tests ---

class TestPhaseSequences:
    def test_full_sequence_length(self):
        assert len(PHASE_SEQUENCE_FULL) == 6

    def test_abbreviated_sequence_length(self):
        assert len(PHASE_SEQUENCE_ABBREVIATED) == 5

    def test_full_sequence_order(self):
        expected = [
            "discovery-0.1", "inception-1.1", "inception-1.2",
            "construction-2.1", "construction-2.2", "construction-2.3"
        ]
        assert PHASE_SEQUENCE_FULL == expected

    def test_abbreviated_sequence_order(self):
        expected = [
            "discovery-0.1-lite", "inception-1.1-lite",
            "construction-2.2-lite", "operations-3.1", "deployment-2.3-lite"
        ]
        assert PHASE_SEQUENCE_ABBREVIATED == expected


# --- get_next_phase Tests ---

class TestGetNextPhase:
    def test_full_flow_progression(self):
        """Walk through entire full flow."""
        phase = PHASE_SEQUENCE_FULL[0]
        visited = [phase]
        while True:
            nxt = get_next_phase(phase, "full")
            if nxt is None:
                break
            visited.append(nxt)
            phase = nxt
        assert visited == PHASE_SEQUENCE_FULL

    def test_abbreviated_flow_progression(self):
        """Walk through entire abbreviated flow."""
        phase = PHASE_SEQUENCE_ABBREVIATED[0]
        visited = [phase]
        while True:
            nxt = get_next_phase(phase, "abbreviated")
            if nxt is None:
                break
            visited.append(nxt)
            phase = nxt
        assert visited == PHASE_SEQUENCE_ABBREVIATED

    def test_full_last_phase_returns_none(self):
        assert get_next_phase("construction-2.3", "full") is None

    def test_abbreviated_last_phase_returns_none(self):
        assert get_next_phase("deployment-2.3-lite", "abbreviated") is None

    def test_invalid_phase_returns_none(self):
        assert get_next_phase("nonexistent", "full") is None
        assert get_next_phase("nonexistent", "abbreviated") is None

    def test_default_flow_type_is_full(self):
        assert get_next_phase("discovery-0.1") == "inception-1.1"


# --- Prompt Mapping Tests ---

class TestPrompts:
    def test_all_full_phases_have_prompts(self):
        for phase in PHASE_SEQUENCE_FULL:
            assert phase in PROMPTS, f"Missing prompt for full phase: {phase}"

    def test_all_abbreviated_phases_have_prompts(self):
        for phase in PHASE_SEQUENCE_ABBREVIATED:
            assert phase in PROMPTS, f"Missing prompt for abbreviated phase: {phase}"

    def test_abbreviated_prompts_have_plan_review_execute(self):
        """Every abbreviated prompt must include plan/review/execute pattern."""
        for phase in PHASE_SEQUENCE_ABBREVIATED:
            prompt = PROMPTS[phase]
            assert "plan" in prompt.lower(), f"{phase} missing plan step"
            assert "approval" in prompt.lower(), f"{phase} missing approval gate"
            assert "checkboxes" in prompt.lower(), f"{phase} missing checkbox tracking"

    def test_prompts_have_use_case_or_feature_placeholder(self):
        """Prompts that need context should have substitution variables."""
        for phase in ["discovery-0.1-lite", "inception-1.1-lite"]:
            assert "{use-case}" in PROMPTS[phase], f"{phase} missing {{use-case}} placeholder"

    def test_abbreviated_prompts_reference_previous_phases(self):
        """Later abbreviated phases should reference earlier phase artifacts."""
        assert "targeted_analysis.md" in PROMPTS["inception-1.1-lite"]
        assert "targeted_analysis.md" in PROMPTS["construction-2.2-lite"]
        assert "user_stories.md" in PROMPTS["construction-2.2-lite"]
        assert "changes_summary.md" in PROMPTS["operations-3.1"]
        assert "validation_report.md" in PROMPTS["deployment-2.3-lite"]


# --- get_flow_type Tests ---

class TestGetFlowType:
    def test_defaults_to_full_when_no_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            assert get_flow_type(tmp) == "full"

    def test_reads_full_from_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            aidlc = os.path.join(tmp, ".aidlc")
            os.makedirs(aidlc)
            with open(os.path.join(aidlc, "current_phase.json"), "w") as f:
                json.dump({"currentPhase": "inception-1.1", "flowType": "full"}, f)
            assert get_flow_type(tmp) == "full"

    def test_reads_abbreviated_from_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            aidlc = os.path.join(tmp, ".aidlc")
            os.makedirs(aidlc)
            with open(os.path.join(aidlc, "current_phase.json"), "w") as f:
                json.dump({"currentPhase": "discovery-0.1-lite", "flowType": "abbreviated"}, f)
            assert get_flow_type(tmp) == "abbreviated"

    def test_defaults_to_full_when_missing_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            aidlc = os.path.join(tmp, ".aidlc")
            os.makedirs(aidlc)
            with open(os.path.join(aidlc, "current_phase.json"), "w") as f:
                json.dump({"currentPhase": "inception-1.1"}, f)
            assert get_flow_type(tmp) == "full"


# --- start_project Integration Tests ---

class TestStartProject:
    @pytest.mark.asyncio
    async def test_greenfield_auto_gets_full_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = await start_project({"projectPath": tmp, "useCase": "build a task app"})
            text = result[0].text
            assert "Full AI-DLC" in text
            assert "inception-1.1" in text
            with open(os.path.join(tmp, ".aidlc", "current_phase.json")) as f:
                data = json.load(f)
            assert data["flowType"] == "full"

    @pytest.mark.asyncio
    async def test_brownfield_auto_gets_full_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Create a source file to make it brownfield
            os.makedirs(os.path.join(tmp, "src"))
            with open(os.path.join(tmp, "src", "main.py"), "w") as f:
                f.write("print('hello')")
            result = await start_project({"projectPath": tmp, "useCase": "fix login bug"})
            text = result[0].text
            assert "Full AI-DLC" in text
            assert "discovery-0.1" in text
            with open(os.path.join(tmp, ".aidlc", "current_phase.json")) as f:
                data = json.load(f)
            assert data["flowType"] == "full"

    @pytest.mark.asyncio
    async def test_brownfield_override_to_full(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "src"))
            with open(os.path.join(tmp, "src", "main.py"), "w") as f:
                f.write("print('hello')")
            result = await start_project({"projectPath": tmp, "useCase": "major new feature", "flowType": "full"})
            text = result[0].text
            assert "Full AI-DLC" in text
            assert "discovery-0.1" in text
            # Should NOT be the lite version
            assert "lite" not in text

    @pytest.mark.asyncio
    async def test_greenfield_override_to_abbreviated(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = await start_project({"projectPath": tmp, "useCase": "quick prototype", "flowType": "abbreviated"})
            text = result[0].text
            assert "Abbreviated" in text


# --- Phase Update Preserves Flow Type ---

class TestUpdatePhasePreservesFlow:
    @pytest.mark.asyncio
    async def test_flow_type_preserved_after_phase_update(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Init as abbreviated
            await start_project({"projectPath": tmp, "useCase": "fix bug", "flowType": "abbreviated"})
            # Update phase
            await update_phase({"projectPath": tmp, "phase": "inception-1.1-lite-ready"})
            with open(os.path.join(tmp, ".aidlc", "current_phase.json")) as f:
                data = json.load(f)
            assert data["flowType"] == "abbreviated"
            assert data["currentPhase"] == "inception-1.1-lite-ready"


# --- get_next_phase_tool Integration ---

class TestGetNextPhaseTool:
    @pytest.mark.asyncio
    async def test_abbreviated_flow_next_phase(self):
        with tempfile.TemporaryDirectory() as tmp:
            await start_project({"projectPath": tmp, "useCase": "fix bug", "flowType": "abbreviated"})
            result = await get_next_phase_tool({"projectPath": tmp})
            text = result[0].text
            assert "inception-1.1-lite" in text
            assert "abbreviated" in text

    @pytest.mark.asyncio
    async def test_full_flow_next_phase(self):
        with tempfile.TemporaryDirectory() as tmp:
            await start_project({"projectPath": tmp, "useCase": "new app", "flowType": "full"})
            result = await get_next_phase_tool({"projectPath": tmp})
            text = result[0].text
            assert "inception-1.2" in text or "inception-1.1" in text
            assert "full" in text


# --- get_prompt Tests ---

class TestGetPrompt:
    @pytest.mark.asyncio
    async def test_abbreviated_prompt_returns_content(self):
        result = await get_prompt({"phase": "discovery-0.1-lite", "useCase": "fix timeout bug"})
        text = result[0].text
        assert "targeted analysis" in text.lower()
        assert "fix timeout bug" in text

    @pytest.mark.asyncio
    async def test_full_prompt_returns_content(self):
        result = await get_prompt({"phase": "inception-1.1", "useCase": "build task app"})
        text = result[0].text
        assert "user stories" in text.lower()
        assert "build task app" in text
