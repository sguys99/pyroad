// 생성물: npm run content:build (content/worlds/*/world.yaml·map.yaml, P5-03). 직접 고치지 않습니다.
import type { WorldInfo } from './worlds';

export const WORLDS: readonly WorldInfo[] = [
  {
    "slug": "python-island",
    "order": 1,
    "title": "파이썬 섬",
    "theme": "python_island",
    "unlock_rule": {
      "type": "open"
    },
    "ready": true,
    "map": {
      "bgm": "world1",
      "path": "catmull_rom",
      "layouts": {
        "wide": {
          "width": 1200,
          "height": 720,
          "node_scale": 1,
          "nodes": [
            [130, 600],
            [330, 470],
            [540, 580],
            [660, 360],
            [880, 500],
            [960, 300],
            [1100, 160]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": 110,
              "y": 50
            },
            {
              "kind": "waves",
              "x": 420,
              "y": 26
            },
            {
              "kind": "boat",
              "x": 210,
              "y": 52
            },
            {
              "kind": "mountains",
              "x": 480,
              "y": 290,
              "scale": 1.3
            },
            {
              "kind": "mountains",
              "x": 770,
              "y": 235,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 70,
              "y": 430,
              "scale": 1.2
            },
            {
              "kind": "tree",
              "x": 230,
              "y": 655,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 790,
              "y": 650,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 1150,
              "y": 480,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 890,
              "y": 175
            },
            {
              "kind": "bird",
              "x": 650,
              "y": 140
            }
          ]
        },
        "tall": {
          "width": 400,
          "height": 1180,
          "node_scale": 0.82,
          "nodes": [
            [104, 1080],
            [292, 930],
            [108, 790],
            [292, 640],
            [112, 495],
            [290, 364],
            [180, 200]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": 50,
              "y": 44
            },
            {
              "kind": "mountains",
              "x": 20,
              "y": 620
            },
            {
              "kind": "mountains",
              "x": 250,
              "y": 770,
              "scale": 0.9
            },
            {
              "kind": "tree",
              "x": 40,
              "y": 960,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 350,
              "y": 1040
            },
            {
              "kind": "tree",
              "x": 30,
              "y": 300
            },
            {
              "kind": "tree",
              "x": 360,
              "y": 520
            }
          ]
        }
      },
      "ambient": {
        "clouds": true,
        "sparkles": true,
        "weather": "leaves"
      }
    }
  },
  {
    "slug": "code-sea",
    "order": 2,
    "title": "코드 바다",
    "theme": "code_sea",
    "unlock_rule": {
      "type": "previous_world_cleared"
    },
    "ready": true,
    "map": {
      "bgm": "world2",
      "path": "catmull_rom",
      "layouts": {
        "wide": {
          "width": 1200,
          "height": 720,
          "node_scale": 1,
          "nodes": [
            [150, 590],
            [345, 440],
            [585, 590],
            [720, 390],
            [500, 235],
            [800, 195],
            [1050, 345]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": 50,
              "y": 120
            },
            {
              "kind": "waves",
              "x": 300,
              "y": 670
            },
            {
              "kind": "waves",
              "x": 860,
              "y": 650
            },
            {
              "kind": "boat",
              "x": 630,
              "y": 105
            },
            {
              "kind": "buoy",
              "x": 430,
              "y": 345
            },
            {
              "kind": "whale",
              "x": 875,
              "y": 505,
              "scale": 1.1
            },
            {
              "kind": "bird",
              "x": 980,
              "y": 110
            },
            {
              "kind": "bird",
              "x": 210,
              "y": 230
            },
            {
              "kind": "palm",
              "x": 90,
              "y": 330,
              "scale": 1.1
            },
            {
              "kind": "palm",
              "x": 1150,
              "y": 560
            },
            {
              "kind": "palm",
              "x": 360,
              "y": 150,
              "scale": 0.9
            },
            {
              "kind": "rock",
              "x": 30,
              "y": 470
            },
            {
              "kind": "rock",
              "x": 1120,
              "y": 150,
              "scale": 1.2
            },
            {
              "kind": "rock",
              "x": 650,
              "y": 690,
              "scale": 0.9
            }
          ]
        },
        "tall": {
          "width": 400,
          "height": 1180,
          "node_scale": 0.82,
          "nodes": [
            [118, 1060],
            [290, 915],
            [110, 770],
            [286, 625],
            [114, 485],
            [282, 352],
            [182, 198]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": 30,
              "y": 70
            },
            {
              "kind": "waves",
              "x": 230,
              "y": 1150
            },
            {
              "kind": "boat",
              "x": 300,
              "y": 80,
              "scale": 0.9
            },
            {
              "kind": "buoy",
              "x": 345,
              "y": 1050
            },
            {
              "kind": "whale",
              "x": 10,
              "y": 625,
              "scale": 0.9
            },
            {
              "kind": "bird",
              "x": 40,
              "y": 300
            },
            {
              "kind": "palm",
              "x": 360,
              "y": 500,
              "scale": 0.9
            },
            {
              "kind": "palm",
              "x": 40,
              "y": 360,
              "scale": 0.85
            },
            {
              "kind": "rock",
              "x": 340,
              "y": 780
            },
            {
              "kind": "rock",
              "x": 20,
              "y": 920,
              "scale": 0.9
            }
          ]
        }
      },
      "ambient": {
        "clouds": true,
        "sparkles": true,
        "weather": "none"
      }
    },
    "skill_check": true
  },
  {
    "slug": "maker-city",
    "order": 3,
    "title": "메이커 시티",
    "theme": "maker_city",
    "unlock_rule": {
      "type": "previous_world_cleared"
    },
    "ready": false,
    "map": {
      "bgm": "world3",
      "path": "catmull_rom",
      "layouts": {
        "wide": {
          "width": 1200,
          "height": 720,
          "node_scale": 1,
          "nodes": [
            [190, 540],
            [420, 610],
            [620, 470],
            [400, 330],
            [640, 200],
            [880, 320],
            [1050, 530]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": -10,
              "y": 700
            },
            {
              "kind": "boat",
              "x": 2,
              "y": 668,
              "scale": 0.75
            },
            {
              "kind": "cog",
              "x": 830,
              "y": 120,
              "scale": 1.3
            },
            {
              "kind": "cog",
              "x": 220,
              "y": 300,
              "scale": 0.9
            },
            {
              "kind": "balloon",
              "x": 470,
              "y": 120
            },
            {
              "kind": "bird",
              "x": 980,
              "y": 210
            },
            {
              "kind": "bird",
              "x": 300,
              "y": 80
            },
            {
              "kind": "house",
              "x": 120,
              "y": 330,
              "scale": 1.1
            },
            {
              "kind": "house",
              "x": 560,
              "y": 340
            },
            {
              "kind": "house",
              "x": 800,
              "y": 620,
              "scale": 1.05
            },
            {
              "kind": "house",
              "x": 1130,
              "y": 350
            },
            {
              "kind": "house",
              "x": 300,
              "y": 470,
              "scale": 0.9
            },
            {
              "kind": "lamp",
              "x": 520,
              "y": 580
            },
            {
              "kind": "lamp",
              "x": 760,
              "y": 410
            },
            {
              "kind": "lamp",
              "x": 260,
              "y": 640
            },
            {
              "kind": "tree",
              "x": 980,
              "y": 660,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 1000,
              "y": 668
            },
            {
              "kind": "tree",
              "x": 60,
              "y": 250,
              "scale": 1.1
            },
            {
              "kind": "tree",
              "x": 720,
              "y": 690
            }
          ]
        },
        "tall": {
          "width": 400,
          "height": 1180,
          "node_scale": 0.82,
          "nodes": [
            [130, 1040],
            [290, 905],
            [122, 770],
            [286, 625],
            [124, 485],
            [282, 350],
            [180, 200]
          ],
          "decorations": [
            {
              "kind": "waves",
              "x": 280,
              "y": 1166
            },
            {
              "kind": "boat",
              "x": 330,
              "y": 1130,
              "scale": 0.8
            },
            {
              "kind": "cog",
              "x": 350,
              "y": 120,
              "scale": 0.9
            },
            {
              "kind": "balloon",
              "x": 60,
              "y": 300,
              "scale": 0.9
            },
            {
              "kind": "bird",
              "x": 300,
              "y": 40
            },
            {
              "kind": "house",
              "x": 340,
              "y": 760,
              "scale": 0.85
            },
            {
              "kind": "house",
              "x": 30,
              "y": 620,
              "scale": 0.85
            },
            {
              "kind": "house",
              "x": 345,
              "y": 480,
              "scale": 0.8
            },
            {
              "kind": "lamp",
              "x": 210,
              "y": 700
            },
            {
              "kind": "lamp",
              "x": 190,
              "y": 980
            },
            {
              "kind": "tree",
              "x": 30,
              "y": 920
            },
            {
              "kind": "tree",
              "x": 370,
              "y": 1020,
              "scale": 0.9
            }
          ]
        }
      },
      "ambient": {
        "clouds": true,
        "sparkles": true,
        "weather": "none"
      }
    }
  }
];
