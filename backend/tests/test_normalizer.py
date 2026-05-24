import sys
sys.path.insert(0, "..")

from parsers.normalizer import normalize_name, normalize_cell, normalize_key, get_section


def test_normalize_name_accents():
    assert normalize_name("Anné") == "ANNE"


def test_normalize_name_apostrophe():
    assert normalize_name("D'HAEN") == "DHAEN"


def test_normalize_name_spaces():
    assert normalize_name("  DE  KOKER  ") == "DE KOKER"


def test_normalize_cell_leading_zeros():
    assert normalize_cell("0522") == 522
    assert normalize_cell("0913") == 913


def test_normalize_cell_int():
    assert normalize_cell(621) == 621


def test_normalize_cell_none():
    assert normalize_cell(None) is None


def test_get_section():
    assert get_section(122) == 1
    assert get_section(215) == 2
    assert get_section(305) == 3
    assert get_section(420) == 4
    assert get_section(510) == 5
    assert get_section(615) == 6
    assert get_section(715) == 7
    assert get_section(809) == 8
    assert get_section(913) == 9
    assert get_section(30) == 10
    assert get_section(999) is None
