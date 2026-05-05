"""Tests for security validations added by threat remediation."""
import json
import tempfile
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from aidlc_mcp.server import (
    validate_project_path, validate_plan_file_path, sanitize_use_case,
    validate_required_string, detect_current_phase, get_flow_type,
    PHASE_SEQUENCE_FULL, PHASE_SEQUENCE_ABBREVIATED,
)


class TestValidateProjectPath:
    def test_rejects_path_traversal(self, tmp_path):
        with pytest.raises(ValueError, match="path traversal"):
            validate_project_path(str(tmp_path / ".." / "etc"), must_exist=False)

    def test_rejects_empty_string(self):
        with pytest.raises(ValueError, match="non-empty"):
            validate_project_path("")

    def test_rejects_non_string(self):
        with pytest.raises(ValueError, match="non-empty"):
            validate_project_path(None)

    def test_rejects_nonexistent_path(self):
        with pytest.raises(ValueError, match="does not exist"):
            validate_project_path("/nonexistent/path/abc123")

    def test_rejects_file_path(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("hi")
        with pytest.raises(ValueError, match="not a directory"):
            validate_project_path(str(f))

    def test_accepts_valid_directory(self, tmp_path):
        result = validate_project_path(str(tmp_path))
        assert result == str(tmp_path.resolve())

    def test_accepts_nonexistent_when_must_exist_false(self, tmp_path):
        p = str(tmp_path / "newproject")
        result = validate_project_path(p, must_exist=False)
        assert "newproject" in result


class TestValidatePlanFilePath:
    def test_rejects_path_outside_aidlc(self, tmp_path):
        f = tmp_path / "plan.md"
        f.write_text("plan")
        with pytest.raises(ValueError, match=".aidlc"):
            validate_plan_file_path(str(f))

    def test_rejects_traversal(self, tmp_path):
        with pytest.raises(ValueError, match="path traversal"):
            validate_plan_file_path(str(tmp_path / ".aidlc" / ".." / "plan.md"))

    def test_accepts_valid_aidlc_path(self, tmp_path):
        aidlc = tmp_path / ".aidlc" / "feature"
        aidlc.mkdir(parents=True)
        f = aidlc / "plan.md"
        f.write_text("plan")
        result = validate_plan_file_path(str(f))
        assert ".aidlc" in result


class TestSanitizeUseCase:
    def test_strips_control_characters(self):
        text, truncated = sanitize_use_case("hello\x00world\x07test")
        assert text == "helloworldtest"
        assert not truncated

    def test_truncates_at_limit(self):
        text, truncated = sanitize_use_case("a" * 1500)
        assert len(text) == 1000
        assert truncated

    def test_no_truncation_under_limit(self):
        text, truncated = sanitize_use_case("short use case")
        assert text == "short use case"
        assert not truncated

    def test_handles_non_string(self):
        text, truncated = sanitize_use_case(123)
        assert text == ""
        assert not truncated

    def test_preserves_unicode(self):
        text, _ = sanitize_use_case("日本語テスト")
        assert text == "日本語テスト"


class TestValidateRequiredString:
    def test_rejects_missing_key(self):
        with pytest.raises(ValueError, match="non-empty"):
            validate_required_string({}, "key")

    def test_rejects_empty_string(self):
        with pytest.raises(ValueError, match="non-empty"):
            validate_required_string({"key": ""}, "key")

    def test_rejects_non_string(self):
        with pytest.raises(ValueError, match="non-empty"):
            validate_required_string({"key": 123}, "key")

    def test_accepts_valid_string(self):
        assert validate_required_string({"key": "value"}, "key") == "value"


class TestPhaseStateValidation:
    def test_detect_rejects_invalid_phase(self, tmp_path):
        aidlc = tmp_path / ".aidlc"
        aidlc.mkdir()
        phase_file = aidlc / "current_phase.json"
        phase_file.write_text(json.dumps({"currentPhase": "invalid-phase", "flowType": "full"}))
        assert detect_current_phase(str(tmp_path)) is None

    def test_detect_rejects_missing_currentPhase(self, tmp_path):
        aidlc = tmp_path / ".aidlc"
        aidlc.mkdir()
        phase_file = aidlc / "current_phase.json"
        phase_file.write_text(json.dumps({"flowType": "full"}))
        assert detect_current_phase(str(tmp_path)) is None

    def test_detect_accepts_valid_phase(self, tmp_path):
        aidlc = tmp_path / ".aidlc"
        aidlc.mkdir()
        phase_file = aidlc / "current_phase.json"
        phase_file.write_text(json.dumps({"currentPhase": "discovery-0.1", "flowType": "full"}))
        assert detect_current_phase(str(tmp_path)) == "discovery-0.1"

    def test_detect_accepts_ready_variant(self, tmp_path):
        aidlc = tmp_path / ".aidlc"
        aidlc.mkdir()
        phase_file = aidlc / "current_phase.json"
        phase_file.write_text(json.dumps({"currentPhase": "inception-1.1-ready", "flowType": "full"}))
        assert detect_current_phase(str(tmp_path)) == "inception-1.1-ready"

    def test_get_flow_type_rejects_invalid(self, tmp_path):
        aidlc = tmp_path / ".aidlc"
        aidlc.mkdir()
        phase_file = aidlc / "current_phase.json"
        phase_file.write_text(json.dumps({"currentPhase": "discovery-0.1", "flowType": "hacked"}))
        assert get_flow_type(str(tmp_path)) == "full"  # falls back to default
