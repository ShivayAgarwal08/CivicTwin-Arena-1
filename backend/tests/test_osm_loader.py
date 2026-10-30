import pytest
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.data.osm_loader import OSMLoader, haversine_m
from app.models.schemas import NetworkNode, NetworkLink


def test_haversine_distance_accuracy():
    lat1, lon1 = 28.5175, 77.3698
    lat2, lon2 = 28.5135, 77.3725
    dist = haversine_m(lat1, lon1, lat2, lon2)
    assert 450.0 < dist < 550.0


def test_parse_osm_elements_with_missing_names():
    sample_elements = [
        {"type": "node", "id": 101, "lat": 28.5175, "lon": 77.3698},
        {"type": "node", "id": 102, "lat": 28.5150, "lon": 77.3710},
        {"type": "node", "id": 103, "lat": 28.5125, "lon": 77.3722},
        # Way 1: Has explicit road name
        {
            "type": "way",
            "id": 1001,
            "nodes": [101, 102],
            "tags": {"highway": "primary", "name": "Noida Frontage Boulevard", "lanes": "3"},
        },
        # Way 2: Missing road name
        {
            "type": "way",
            "id": 1002,
            "nodes": [102, 103],
            "tags": {"highway": "secondary"},
        },
    ]

    nodes, links, warnings = OSMLoader.parse_osm_elements(sample_elements)
    assert len(nodes) == 3
    assert len(links) >= 2

    named_link = next((l for l in links if "Noida Frontage" in l.name), None)
    assert named_link is not None
    assert named_link.lanes == 3
    assert named_link.base_capacity_vph == 4800.0

    unnamed_link = next((l for l in links if "Unnamed" in l.name), None)
    assert unnamed_link is not None
    assert "Secondary" in unnamed_link.name
    assert unnamed_link.lanes == 2
    assert unnamed_link.base_capacity_vph == 2600.0


def test_disconnected_component_pruning():
    sample_elements = [
        {"type": "node", "id": 201, "lat": 28.50, "lon": 77.30},
        {"type": "node", "id": 202, "lat": 28.51, "lon": 77.31},
        {"type": "node", "id": 301, "lat": 28.60, "lon": 77.40},
        {"type": "node", "id": 302, "lat": 28.61, "lon": 77.41},
        {"type": "way", "id": 2001, "nodes": [201, 202], "tags": {"highway": "primary"}},
        {"type": "way", "id": 3001, "nodes": [301, 302], "tags": {"highway": "residential"}},
    ]

    nodes, links, warnings = OSMLoader.parse_osm_elements(sample_elements)
    assert len(nodes) == 2
    assert len(warnings) > 0
    assert "Pruned" in warnings[0]


def test_empty_elements_diagnostic_failure():
    nodes, links, warnings = OSMLoader.parse_osm_elements([])
    assert len(nodes) == 0
    assert len(links) == 0
    assert len(warnings) > 0
    assert "No vehicular road ways found" in warnings[0]


def test_save_and_reload_study_area(tmp_path):
    nodes = [
        NetworkNode(id="n1", name="Junction Alpha", lat=28.50, lon=77.30, is_signalized=True),
        NetworkNode(id="n2", name="Junction Beta", lat=28.51, lon=77.31, is_signalized=False),
    ]
    links = [
        NetworkLink(
            id="l1",
            name="Alpha-Beta Connector",
            from_node="n1",
            to_node="n2",
            length_m=450.0,
            free_flow_speed_kmh=45.0,
            base_capacity_vph=2400.0,
            effective_capacity_vph=2400.0,
            lanes=2,
            coordinates=[[77.30, 28.50], [77.31, 28.51]],
            highway_type="secondary",
        )
    ]
    demand = OSMLoader.synthesize_demand_for_network(nodes, links)

    fpath = OSMLoader.save_study_area(
        area_id="test_custom_corridor",
        name="Test Corridor",
        city="Test City",
        problem_statement="Congested bypass",
        objective="Improve flow",
        nodes=nodes,
        links=links,
        demand=demand,
        metadata={"center": [28.505, 77.305], "zoom": 16},
    )

    assert os.path.exists(fpath)

    loaded = OSMLoader.load_study_area("test_custom_corridor")
    assert loaded is not None
    loaded_nodes, loaded_links, loaded_demand, meta = loaded
    assert len(loaded_nodes) == 2
    assert len(loaded_links) == 1
    assert loaded_links[0].name == "Alpha-Beta Connector"
    assert meta["city"] == "Test City"

    if os.path.exists(fpath):
        os.remove(fpath)
