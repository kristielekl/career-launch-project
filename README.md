# career-launch-project
cmpe 131 term project 1 
CareerLaunch - career prep & progress tracker for cs students

-----------------
FOLDER STRUCTURE 
----------------
This shows a basic ROUGH format of the folders and files in the project with a brief ideas of what it MAY be used for. They can be subject to change or reorangized as needed. Devs may create or delete files or folders as needed. 
It is recommended to update README.md on current structure.

~~~bash
career-launch-project/
│
├── README.md                       # Main GitHub project documentation
├─
│
└── cmpe131-starter-ready/            # provided by professor
    │
    ├── public/                     # PRESENTATION / UI LAYER
    │   │                           
    │   │
    │   ├── index.html              # Dashboard / homepage   (starter-folder provided)
    │   ├── timeline.html           # TimelineTask list and status controls
    │   ├── create.html             # Create TimelineTask form ( starter-folder provided)    
    │   ├── edit.html               # Edit TimelineTask form  (starter-folder provided)
    │   ├── question-map.html       # Coding questions organized by topic
    │   ├── resources.html          # Career Resources page
    │   │
    │   ├── css/
    │   │   └── styles.css          # Shared page styling
    │   │
    │   └── js/
    │       ├── timeline.js         # TimelineTask browser actions and API calls
    │       ├── dashboard.js        # Display Timeline and progress summaries
    │       └── questions.js        # Question Map and completion controls
    │
    ├── routes/                     # APPLICATION LAYER — EXPRESS ROUTES
    │   │                           
    │   ├── timelineRoutes.js       # TimelineTask GET/POST/PUT/DELETE
    │   └── progressRoutes.js       # QuestionProgress GET/Update
    │
    ├── services/                   # APPLICATION / BUSINESS LOGIC
    │   │                          
    │   ├── timelineService.js      # Task validation, ownership, status rules
    │   └── progressService.js      # Progress validation and business rules
    │
    ├── repositories/               # DATA ACCESS / PERSISTENCE LAYER
    │   │                           
    │   ├── timelineRepository.js   # TimelineTask SQLite CRUD queries
    │   └── progressRepository.js   # QuestionProgress SQLite queries
    │
    ├── tests/                      # DEVELOPER / AUTOMATED TESTS
    │   │                           # Developers + QA (Cindy)
    │   ├── timeline.test.js        # TimelineTask tests
    │   └── progress.test.js        # QuestionProgress tests
    │
    ├── db.js                       # DATABASE LAYER — SQLite setup  (starter-folder provided)
    ├── database.sqlite             # Generated local SQLite database
    │
    ├── server.js                   # Express server entry point  (starter-folder provided)
    ├── package.json                # Node.js dependencies and npm scripts
    ├── package-lock.json           # Locked dependency versions
    ├── README.md                   # Application setup/run instructions
    ├── .gitignore                  # Optional application-specific Git rules
    │
    └── node_modules/               # Installed npm packages (DO NOT COMMIT)
~~~
