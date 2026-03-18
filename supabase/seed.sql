-- ============================================================
-- CONSULTANT OS – Seed Data  (v2 – comprehensive)
-- Run AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- ── Workspaces ───────────────────────────────────────────────
insert into workspaces (id, name, client, sector, sector_color, type, language, progress, status, docs_count, meetings_count, tasks_count, contributors, last_activity, description) values
('ws-001','NCA Digital Transformation Program','National Communications Authority','Government','#0EA5E9','Client','Bilingual',68,'Active',124,38,47,'{"AM","SK","RT","JL"}','2 hours ago','End-to-end digital transformation initiative covering enterprise architecture, process automation, and citizen service delivery modernization across 14 workstreams.'),
('ws-002','ADNOC Supply Chain Optimization','Abu Dhabi National Oil Company','Energy','#F59E0B','Client','EN',45,'Active',89,22,31,'{"MK","AS","DN"}','5 hours ago','Supply chain process re-engineering and ERP integration for upstream and midstream operations with SAP S/4HANA.'),
('ws-003','MOCI Procurement Reform','Ministry of Commerce & Industry','Government','#0EA5E9','Procurement','Bilingual',82,'Active',156,45,28,'{"FH","AM","SK"}','1 hour ago','Comprehensive procurement framework overhaul aligned with Federal Procurement Law No. 12/2025 and e-procurement platform rollout.'),
('ws-004','Healthcare Digital Strategy','Abu Dhabi Health Services (SEHA)','Healthcare','#10B981','Client','EN',30,'Active',67,18,22,'{"SK","DN"}','Yesterday','Digital health transformation strategy covering EMR integration, telemedicine platform, and patient experience improvement across 14 hospitals.'),
('ws-005','Smart City Infrastructure PMO','Abu Dhabi City Municipality','Infrastructure','#8B5CF6','Project','Bilingual',55,'Active',203,61,89,'{"JL","RT","AM","MK","FH"}','3 hours ago','Program management office for AED 6.8B smart city infrastructure program across 12 concurrent workstreams including IoT, mobility, and utilities.'),
('ws-006','Banking Core Transformation','Emirates National Bank','Financial Services','#F59E0B','Client','EN',91,'Active',312,87,14,'{"DN","AS"}','4 hours ago','Core banking system migration from legacy platform to Oracle FLEXCUBE and digital channel modernization program approaching final go-live.'),
('ws-007','Internal Quality Framework','Accel Consulting (Internal)','Internal','#94A3B8','Internal','EN',75,'Active',44,12,19,'{"AM","SK"}','Yesterday','Internal ISO 9001:2015 quality management framework implementation and continuous improvement program for consulting delivery excellence.'),
('ws-008','Retail Digital Commerce','LuLu Hypermarket Group','Retail','#EC4899','Client','Bilingual',22,'Active',31,8,15,'{"RT","JL"}','2 days ago','Omnichannel digital commerce platform and loyalty program for regional expansion across UAE, KSA, and Kuwait markets.')
on conflict (id) do update set
  name = excluded.name, client = excluded.client, sector = excluded.sector,
  sector_color = excluded.sector_color, type = excluded.type, language = excluded.language,
  progress = excluded.progress, status = excluded.status, docs_count = excluded.docs_count,
  meetings_count = excluded.meetings_count, tasks_count = excluded.tasks_count,
  contributors = excluded.contributors, last_activity = excluded.last_activity,
  description = excluded.description, updated_at = now();

-- ── Workspace Financials ─────────────────────────────────────
insert into workspace_financials (id, workspace_id, workspace_name, contract_value, spent, forecast, variance, currency, billing_model, last_invoice, next_milestone_value) values
('fin-001','ws-001','NCA Digital Transformation Program',4200000,2856000,4150000,-50000,'SAR','Fixed Fee','15 Feb 2026',840000),
('fin-002','ws-002','ADNOC Supply Chain Optimization',3500000,1575000,3650000,150000,'SAR','Time & Material','01 Mar 2026',700000),
('fin-003','ws-003','MOCI Procurement Reform',2800000,2576000,2820000,20000,'SAR','Fixed Fee','28 Feb 2026',224000),
('fin-004','ws-004','Healthcare Digital Strategy',1950000,877500,1930000,-20000,'SAR','Retainer','01 Mar 2026',390000),
('fin-005','ws-005','Smart City Infrastructure PMO',6800000,3060000,7100000,300000,'SAR','Fixed Fee','10 Mar 2026',1360000),
('fin-006','ws-006','Banking Core Transformation',1200000,1080000,1250000,50000,'SAR','Fixed Fee','05 Mar 2026',120000),
('fin-007','ws-007','Internal Quality Framework',890000,445000,870000,-20000,'SAR','T&M','01 Mar 2026',178000),
('fin-008','ws-008','Retail Digital Commerce',2100000,840000,2100000,0,'SAR','Fixed Fee','20 Feb 2026',525000)
on conflict (id) do update set
  workspace_name = excluded.workspace_name,
  contract_value = excluded.contract_value, spent = excluded.spent, forecast = excluded.forecast,
  variance = excluded.variance, currency = excluded.currency, billing_model = excluded.billing_model,
  last_invoice = excluded.last_invoice, next_milestone_value = excluded.next_milestone_value,
  updated_at = now();

-- ── Workspace RAG Status ─────────────────────────────────────
insert into workspace_rag_status (id, workspace_id, rag, budget, schedule, risk, last_updated) values
('rag-001','ws-001','Green','Green','Green','Amber','12 Mar 2026'),
('rag-002','ws-002','Amber','Amber','Green','Amber','10 Mar 2026'),
('rag-003','ws-003','Green','Amber','Green','Green','11 Mar 2026'),
('rag-004','ws-004','Green','Green','Green','Green','09 Mar 2026'),
('rag-005','ws-005','Amber','Red','Amber','Red','13 Mar 2026'),
('rag-006','ws-006','Green','Green','Amber','Green','12 Mar 2026'),
('rag-007','ws-007','Green','Green','Green','Green','10 Mar 2026'),
('rag-008','ws-008','Green','Green','Green','Amber','12 Mar 2026')
on conflict (id) do update set
  rag = excluded.rag, budget = excluded.budget, schedule = excluded.schedule,
  risk = excluded.risk, last_updated = excluded.last_updated, updated_at = now();

-- ── Milestones ───────────────────────────────────────────────
insert into milestones (id, workspace_id, title, due_date, status, value, owner, completion_pct) values
-- NCA Digital Transformation
('ms-001','ws-001','Phase 1: Requirements & Stakeholder Alignment','15 Jan 2026','Completed',840000,'AM',100),
('ms-002','ws-001','Phase 2: Enterprise Architecture Delivery','28 Feb 2026','Completed',1050000,'AM',100),
('ms-003','ws-001','Phase 3: Pilot Implementation (3 Agencies)','15 Apr 2026','On Track',1260000,'SK',62),
('ms-004','ws-001','Phase 4: Full Rollout & National Go-Live','30 Jun 2026','Upcoming',1050000,'AM',0),
-- ADNOC Supply Chain
('ms-005','ws-002','As-Is Assessment & Gap Analysis','31 Jan 2026','Completed',700000,'MK',100),
('ms-006','ws-002','To-Be Process Design & ERP Blueprint','31 Mar 2026','On Track',875000,'AS',72),
('ms-007','ws-002','ERP Configuration & Integration Build','30 Jun 2026','Upcoming',1400000,'MK',0),
-- MOCI Procurement Reform
('ms-008','ws-003','Policy Framework Approval','10 Mar 2026','Completed',560000,'FH',100),
('ms-009','ws-003','E-Procurement Platform Go-Live','01 May 2026','On Track',1120000,'AM',58),
('ms-010','ws-003','Training & Change Management Completion','30 Jun 2026','Upcoming',560000,'SK',0),
-- Healthcare Digital Strategy
('ms-011','ws-004','Strategy Definition & Roadmap','28 Feb 2026','Completed',390000,'SK',100),
('ms-012','ws-004','EMR Vendor Selection & Contracting','30 Apr 2026','At Risk',585000,'DN',35),
('ms-013','ws-004','Pilot EMR Implementation (2 Hospitals)','30 Sep 2026','Upcoming',780000,'SK',0),
-- Smart City PMO
('ms-014','ws-005','Package 1: IoT Infrastructure Delivery','31 Mar 2026','On Track',2040000,'JL',78),
('ms-015','ws-005','Package 2: Mobility & Transport Systems','31 Jul 2026','At Risk',2040000,'RT',22),
('ms-016','ws-005','Package 3: Utilities & Grid Modernization','31 Dec 2026','Upcoming',1360000,'JL',5),
-- Banking Core Transformation
('ms-017','ws-006','UAT Completion & Sign-Off','15 Mar 2026','Completed',360000,'DN',100),
('ms-018','ws-006','Go-Live Preparation & Cutover Readiness','01 Apr 2026','On Track',480000,'AS',91),
('ms-019','ws-006','Post Go-Live Hypercare (30 Days)','01 May 2026','Upcoming',120000,'DN',0),
-- Internal & Retail
('ms-020','ws-007','ISO 9001 Gap Assessment & Action Plan','31 Jan 2026','Completed',178000,'AM',100),
('ms-021','ws-007','Process Documentation & QMS Build','30 Apr 2026','On Track',356000,'SK',68),
('ms-022','ws-008','Digital Commerce Platform RFP & Selection','15 Apr 2026','On Track',525000,'RT',45),
('ms-023','ws-008','Platform Build Phase 1 (UAE)','31 Aug 2026','Upcoming',1050000,'JL',0)
on conflict (id) do update set
  title = excluded.title, due_date = excluded.due_date, status = excluded.status,
  value = excluded.value, owner = excluded.owner, completion_pct = excluded.completion_pct,
  updated_at = now();

-- ── Documents ────────────────────────────────────────────────
insert into documents (id, name, type, type_color, workspace, workspace_id, date, language, status, size, author, pages, summary, tags) values
-- NCA
('doc-001','NCA Digital Transformation – BRD v3.2','BRD','#0EA5E9','NCA Digital Transformation Program','ws-001','2026-03-10','Bilingual','Approved','2.4 MB','Ahmed Al-Mahmoud',87,'Comprehensive business requirements document covering all 14 digital transformation workstreams including citizen portal, backend integration, and reporting systems.','{"requirements","transformation","approved","bilingual"}'),
('doc-002','NCA Enterprise Architecture Blueprint v2.1','Architecture','#8B5CF6','NCA Digital Transformation Program','ws-001','2026-02-28','EN','Final','5.1 MB','Sara Khalid',124,'Target enterprise architecture including integration layer, cloud migration strategy, API gateway design, and cybersecurity framework.','{"architecture","blueprint","cloud","security"}'),
('doc-003','NCA Phase 3 Implementation Plan','Project Plan','#10B981','NCA Digital Transformation Program','ws-001','2026-03-05','EN','Under Review','1.8 MB','Raj Thomas',45,'Detailed implementation plan for Phase 3 pilot covering 3 pilot agencies with RACI matrix, rollout schedule, and risk register.','{"implementation","phase3","pilot"}'),
('doc-004','NCA Steering Committee Presentation – Mar 2026','Presentation','#F59E0B','NCA Digital Transformation Program','ws-001','2026-03-12','Bilingual','Final','8.2 MB','Ahmed Al-Mahmoud',28,'Monthly steering committee deck covering Phase 2 completion, Phase 3 status, budget position, and upcoming decisions required.','{"steering-committee","presentation","monthly"}'),
('doc-005','NCA Data Migration Strategy & Mapping','Technical Spec','#EC4899','NCA Digital Transformation Program','ws-001','2026-03-08','EN','Under Review','3.4 MB','Sara Khalid',56,'Data migration strategy covering 14 legacy systems with field-level mapping, data quality rules, and cutover approach.','{"data-migration","mapping","technical"}'),
-- ADNOC
('doc-006','ADNOC Supply Chain As-Is Assessment','Assessment','#F59E0B','ADNOC Supply Chain Optimization','ws-002','2026-02-15','EN','Approved','3.2 MB','Mohammed Khalid',67,'Current-state assessment of supply chain operations across upstream, midstream, and downstream with 47 identified improvement opportunities.','{"assessment","supply-chain","as-is"}'),
('doc-007','ADNOC ERP Integration Technical Specification','Technical Spec','#0EA5E9','ADNOC Supply Chain Optimization','ws-002','2026-03-01','EN','Draft','1.9 MB','Ahmed Salem',38,'Technical specification for SAP S/4HANA integration with existing ADNOC Oracle EBS and in-house SCADA systems.','{"ERP","SAP","integration","technical"}'),
('doc-008','ADNOC To-Be Process Design – Procurement','Process Design','#10B981','ADNOC Supply Chain Optimization','ws-002','2026-03-10','EN','Under Review','2.6 MB','Mohammed Khalid',54,'Future-state procurement process design including 12 reengineered workflows, approval matrices, and automation opportunities.','{"process-design","procurement","to-be"}'),
-- MOCI
('doc-009','MOCI Procurement Framework v2.0','Policy','#10B981','MOCI Procurement Reform','ws-003','2026-03-08','Bilingual','Approved','4.7 MB','Fatima Hassan',156,'Updated procurement policy framework aligned with Federal Procurement Law No. 12/2025 covering 8 procurement categories and 23 policy updates.','{"policy","procurement","approved","bilingual"}'),
('doc-010','MOCI E-Procurement Platform BRD','BRD','#0EA5E9','MOCI Procurement Reform','ws-003','2026-02-20','Bilingual','Approved','3.1 MB','Ahmed Al-Mahmoud',94,'Business requirements for the national e-procurement platform covering supplier portal, tender management, and contract lifecycle management.','{"BRD","e-procurement","requirements"}'),
('doc-011','MOCI Training Needs Analysis','Assessment','#F59E0B','MOCI Procurement Reform','ws-003','2026-03-05','Bilingual','Final','1.2 MB','Sara Khalid',33,'Training needs assessment across 450 procurement officers at 23 government entities with recommended curriculum.','{"training","needs-analysis","change-management"}'),
-- Healthcare
('doc-012','SEHA Digital Health Strategy 2026–2030','Strategy','#10B981','Healthcare Digital Strategy','ws-004','2026-02-25','EN','Final','6.8 MB','Sara Khalid',112,'Five-year digital health transformation strategy covering EMR, telemedicine, AI diagnostics, and patient experience platform.','{"strategy","digital-health","roadmap"}'),
('doc-013','EMR Vendor Evaluation Matrix','Evaluation','#8B5CF6','Healthcare Digital Strategy','ws-004','2026-03-12','EN','Under Review','2.1 MB','David Ng',48,'Quantitative evaluation of 5 shortlisted EMR vendors across 78 functional and non-functional criteria.','{"EMR","vendor-evaluation","scoring-matrix"}'),
-- Smart City
('doc-014','Smart City PMO Charter v1.2','Charter','#8B5CF6','Smart City Infrastructure PMO','ws-005','2026-01-15','Bilingual','Final','0.9 MB','James Lee',22,'Program charter defining governance model, reporting structure, escalation paths, and success criteria for AED 6.8B Smart City program.','{"charter","PMO","governance","smart-city"}'),
('doc-015','Smart City Package 1 – Technical Delivery Report','Report','#0EA5E9','Smart City Infrastructure PMO','ws-005','2026-03-10','EN','Under Review','12.4 MB','James Lee',178,'Package 1 progress report covering IoT sensor deployment (78%), network infrastructure, and early operations dashboard.','{"package-1","technical","IoT","progress"}'),
('doc-016','Smart City Risk Register – Q1 2026','Risk Register','#EF4444','Smart City Infrastructure PMO','ws-005','2026-03-13','Bilingual','Under Review','1.1 MB','Raj Thomas',31,'Updated risk register with 28 active risks, 6 escalations, and mitigation status for Q1 2026 reporting.','{"risk-register","Q1-2026","escalation"}'),
-- Banking
('doc-017','Banking Core Migration Runbook v4.0','Technical','#F59E0B','Banking Core Transformation','ws-006','2026-03-12','EN','Approved','8.3 MB','David Ng',203,'Detailed go-live runbook for Oracle FLEXCUBE cutover on 01 Apr 2026 with minute-by-minute cutover plan and rollback procedures.','{"migration","runbook","go-live","banking"}'),
('doc-018','ENB UAT Final Test Report','Test Report','#10B981','Banking Core Transformation','ws-006','2026-03-14','EN','Final','4.2 MB','Ahmed Salem',87,'Final UAT test report covering 1,247 test cases with 99.2% pass rate and 3 outstanding P1 items.','{"UAT","testing","banking","final"}'),
-- Internal & Retail
('doc-019','Accel ISO 9001 Gap Assessment Report','Assessment','#94A3B8','Internal Quality Framework','ws-007','2026-01-28','EN','Final','1.6 MB','Ahmed Al-Mahmoud',41,'Gap assessment against ISO 9001:2015 requirements covering all 10 clauses with 34 identified improvement actions.','{"ISO-9001","gap-assessment","quality"}'),
('doc-020','LuLu Digital Commerce Platform RFP','Proposal','#EC4899','Retail Digital Commerce','ws-008','2026-03-01','Bilingual','Draft','3.8 MB','Raj Thomas',67,'Request for Proposal for omnichannel digital commerce platform covering e-commerce, loyalty, and in-store integration.','{"RFP","digital-commerce","e-commerce","loyalty"}')
on conflict (id) do nothing;

-- ── Meetings ──────────────────────────────────────────────────
insert into meetings (id, title, date, time, duration, type, status, participants, workspace, workspace_id, minutes_generated, actions_extracted, decisions_logged, location, quorum_status) values
-- NCA
('mtg-001','NCA Phase 3 Kick-Off Steering Committee','2026-03-20','10:00','2h','Steering','Upcoming','{"AM","SK","RT","NCA-CEO","NCA-CTO","NCA-DG"}','NCA Digital Transformation Program','ws-001',false,0,0,'NCA HQ – Boardroom A','Met'),
('mtg-002','NCA Weekly PMO Standup – W11','2026-03-18','09:00','45m','Standup','Upcoming','{"AM","SK","RT","JL"}','NCA Digital Transformation Program','ws-001',false,0,0,'Virtual – MS Teams',null),
('mtg-003','NCA Architecture Review Workshop','2026-03-08','13:00','3h','Workshop','Completed','{"AM","SK","RT","Vendor-Arch"}','NCA Digital Transformation Program','ws-001',true,8,3,'NCA HQ – Room 201','Met'),
('mtg-004','NCA Data Migration Technical Review','2026-03-15','14:00','1.5h','Review','Completed','{"SK","RT","NCA-IT-Lead"}','NCA Digital Transformation Program','ws-001',true,5,2,'Virtual – MS Teams','Met'),
('mtg-005','NCA Phase 2 Closeout Meeting','2026-03-05','10:00','2h','Review','Completed','{"AM","SK","RT","NCA-CEO","NCA-CTO"}','NCA Digital Transformation Program','ws-001',true,9,5,'NCA HQ – Boardroom A','Met'),
-- ADNOC
('mtg-006','ADNOC ERP Vendor Evaluation Session','2026-03-18','11:00','2h','Review','Upcoming','{"MK","AS","ADNOC-CPO","ADNOC-IT"}','ADNOC Supply Chain Optimization','ws-002',false,0,0,'ADNOC Tower – Floor 22','Met'),
('mtg-007','ADNOC Process Design Workshop – Procurement','2026-03-12','09:00','4h','Workshop','Completed','{"MK","AS","ADNOC-SCM-Head"}','ADNOC Supply Chain Optimization','ws-002',true,11,4,'ADNOC Tower – Conference Room 3','Met'),
-- MOCI
('mtg-008','MOCI Procurement Committee Session #8','2026-03-11','10:00','2h','Committee','Completed','{"FH","AM","MOCI-DG","MOCI-CFO","MOCI-Legal"}','MOCI Procurement Reform','ws-003',true,6,4,'MOCI HQ – Hall B','Met'),
('mtg-009','MOCI E-Procurement Platform Steering','2026-03-25','10:00','1.5h','Steering','Upcoming','{"FH","AM","SK","MOCI-DG","IT-Vendor"}','MOCI Procurement Reform','ws-003',false,0,0,'MOCI HQ – Boardroom','Met'),
('mtg-010','MOCI Training Rollout Planning','2026-03-14','13:00','1h','Review','Completed','{"SK","FH","HR-Lead"}','MOCI Procurement Reform','ws-003',true,4,1,'Virtual – Zoom',null),
-- Healthcare
('mtg-011','SEHA Digital Health Strategy Workshop','2026-03-25','09:00','4h','Workshop','Upcoming','{"SK","DN","SEHA-CEO","MOH-ADG","SEHA-CIO"}','Healthcare Digital Strategy','ws-004',false,0,0,'SEHA Boardroom – Abu Dhabi',null),
('mtg-012','EMR Vendor Demos – Day 1 (Epic & Cerner)','2026-03-22','10:00','3h','Review','Upcoming','{"SK","DN","SEHA-CIO","Clinical-Lead"}','Healthcare Digital Strategy','ws-004',false,0,0,'SEHA HQ – Conference Room 1','Met'),
-- Smart City
('mtg-013','Smart City Package 1 Progress Review','2026-03-17','14:00','1.5h','Review','Upcoming','{"JL","RT","AM","Municipality-PM","Contractor-PM"}','Smart City Infrastructure PMO','ws-005',false,0,0,'Municipality HQ – Meeting Room A','Met'),
('mtg-014','Smart City ExCo Monthly Update','2026-03-10','09:00','2h','Committee','Completed','{"JL","RT","Municipality-CE","ExCo-Members"}','Smart City Infrastructure PMO','ws-005',true,7,5,'Municipality HQ – Boardroom','Met'),
('mtg-015','Smart City Risk Review – Critical Items','2026-03-16','11:00','1h','Review','Completed','{"JL","AM","Risk-Manager"}','Smart City Infrastructure PMO','ws-005',true,4,2,'Virtual – MS Teams',null),
('mtg-016','Smart City Package 3 Contractor Briefing','2026-03-28','14:00','2h','Workshop','Upcoming','{"JL","RT","Contractor-3","Municipality-Eng"}','Smart City Infrastructure PMO','ws-005',false,0,0,'Municipality HQ – Meeting Room B',null),
-- Banking
('mtg-017','Banking Go-Live Readiness Review','2026-03-14','09:00','2h','Review','Completed','{"DN","AS","ENB-CTO","ENB-COO","ENB-CISO"}','Banking Core Transformation','ws-006',true,5,2,'ENB Head Office – Floor 18','Met'),
('mtg-018','ENB UAT Final Signoff','2026-03-10','10:00','1.5h','Review','Completed','{"DN","AS","ENB-QA-Lead","ENB-CTO"}','Banking Core Transformation','ws-006',true,3,3,'ENB Head Office – IT Wing','Met'),
('mtg-019','Banking Go-Live War Room Planning','2026-03-28','09:00','3h','Steering','Upcoming','{"DN","AS","ENB-CTO","ENB-IT-Director"}','Banking Core Transformation','ws-006',false,0,0,'ENB Head Office – War Room','Met'),
-- Internal & Retail
('mtg-020','Accel QMS Audit Preparation','2026-03-20','14:00','1h','Review','Upcoming','{"AM","SK","ISO-Auditor"}','Internal Quality Framework','ws-007',false,0,0,'Accel Office – Meeting Room 1',null),
('mtg-021','LuLu Platform RFP Shortlisting','2026-03-26','11:00','2h','Review','Upcoming','{"RT","JL","LuLu-CTO","LuLu-CDO"}','Retail Digital Commerce','ws-008',false,0,0,'LuLu HQ – Dubai Office','Met')
on conflict (id) do nothing;

-- ── Tasks ─────────────────────────────────────────────────────
insert into tasks (id, title, workspace, workspace_id, priority, status, due_date, assignee, description) values
-- NCA
('tsk-001','Finalize Phase 3 resource allocation and staffing plan','NCA Digital Transformation Program','ws-001','High','In Progress','2026-03-20','AM','Confirm staffing for 3 pilot agencies, assign team leads, and sign resource confirmation letters with NCA HR.'),
('tsk-002','Complete data migration field-level mapping for all 14 systems','NCA Digital Transformation Program','ws-001','High','In Progress','2026-03-25','SK','Map all legacy data fields to target Oracle schema including transformation rules, data quality thresholds, and null-handling logic.'),
('tsk-003','Draft NCA stakeholder communication and change management plan','NCA Digital Transformation Program','ws-001','Medium','Backlog','2026-04-01','RT','Prepare stakeholder communication plan for Phase 3 go-live covering 3 pilot agencies, all-staff comms, and training schedule.'),
('tsk-004','Review and update Phase 3 risk register with Phase 2 lessons','NCA Digital Transformation Program','ws-001','Medium','In Review','2026-03-22','AM','Incorporate 12 lessons learned from Phase 2 close-out into updated risk register with revised probability/impact scores.'),
('tsk-005','Prepare Steering Committee deck for 20 March session','NCA Digital Transformation Program','ws-001','High','Completed','2026-03-19','AM','Monthly steering deck covering Phase 2 completion confirmation, Phase 3 status, budget, and Q2 priorities.'),
-- ADNOC
('tsk-006','Submit ERP integration specification for ADNOC IT review','ADNOC Supply Chain Optimization','ws-002','High','In Review','2026-03-18','MK','Submit SAP S/4HANA integration specification to ADNOC IT Architecture team for technical review and sign-off.'),
('tsk-007','Coordinate and facilitate SAP vendor demo sessions','ADNOC Supply Chain Optimization','ws-002','Medium','In Progress','2026-03-22','AS','Schedule 3-day vendor demonstration programme with SAP, Oracle, and Microsoft Dynamics for ADNOC evaluation team.'),
('tsk-008','Finalize procurement process To-Be design for 12 workflows','ADNOC Supply Chain Optimization','ws-002','High','In Progress','2026-03-28','MK','Complete future-state process maps for all 12 procurement workflows incorporating ADNOC legal and compliance requirements.'),
-- MOCI
('tsk-009','Update procurement policy manual with legal review comments','MOCI Procurement Reform','ws-003','High','Completed','2026-03-10','FH','Incorporate 23 comments from MOCI Legal Counsel and Ministry of Finance review into Policy Framework v2.0.'),
('tsk-010','Develop e-procurement training curriculum for 450 officers','MOCI Procurement Reform','ws-003','Medium','In Progress','2026-04-05','SK','Design 3-tier training programme: awareness (4h), user (8h), and super-user (16h) for procurement system rollout.'),
('tsk-011','Finalise supplier onboarding portal requirements','MOCI Procurement Reform','ws-003','High','In Review','2026-03-24','AM','Complete supplier portal requirements covering registration, document upload, bid submission, and award notification workflows.'),
-- Healthcare
('tsk-012','Complete EMR vendor scoring and recommendation paper','Healthcare Digital Strategy','ws-004','High','In Progress','2026-03-28','SK','Score 5 shortlisted EMR vendors across 78 criteria and prepare recommendation paper for SEHA ExCo approval.'),
('tsk-013','Schedule and facilitate vendor demo sessions (Epic, Cerner, InterSystems)','Healthcare Digital Strategy','ws-004','Medium','In Progress','2026-03-22','DN','Coordinate 3-day vendor demonstration programme with clinical leads and IT team. Prepare demo script and evaluation sheets.'),
('tsk-014','Conduct vendor financial due diligence on shortlisted EMR vendors','Healthcare Digital Strategy','ws-004','High','Backlog','2026-04-10','SK','Commission financial health check on 2 highest-scored vendors to assess stability and contractual risk.'),
-- Smart City
('tsk-015','Compile Package 1 milestone handover documentation','Smart City Infrastructure PMO','ws-005','High','In Progress','2026-03-28','JL','Prepare full handover pack for Package 1 including as-built drawings, testing reports, handover certificates, and warranty documents.'),
('tsk-016','Issue urgent change notice for Package 3 contractor','Smart City Infrastructure PMO','ws-005','High','In Progress','2026-03-19','JL','Draft and issue change notice to Package 3 contractor for mobilisation delay and engage backup contractor roster per contractual clause 8.3.'),
('tsk-017','Update Smart City risk register – Q1 2026 report','Smart City Infrastructure PMO','ws-005','Medium','Completed','2026-03-15','RT','Update all 28 risk entries, close 4 resolved risks, escalate 2 critical items to ExCo report.'),
('tsk-018','Prepare Package 2 scope review for Municipality','Smart City Infrastructure PMO','ws-005','High','Backlog','2026-04-07','RT','Compile scope review options paper for Package 2 mobility workstream to address AED 320M budget pressure.'),
-- Banking
('tsk-019','Resolve 3 outstanding P1 UAT defects before go-live','Banking Core Transformation','ws-006','High','Overdue','2026-03-12','DN','Critical: resolve defects BNK-UAT-0247 (FX processing), BNK-UAT-0251 (SWIFT MT103), BNK-UAT-0263 (balance sheet) before cutover clearance.'),
('tsk-020','Finalise go-live cutover runbook and communications plan','Banking Core Transformation','ws-006','High','In Progress','2026-03-26','AS','Complete minute-by-minute cutover runbook for 01 Apr go-live weekend and prepare staff communications for all 47 branches.'),
('tsk-021','Conduct hypercare support planning and team briefing','Banking Core Transformation','ws-006','Medium','Backlog','2026-03-28','DN','Define 30-day hypercare structure, L1/L2 support rota, escalation matrix, and daily war-room schedule for post-go-live period.'),
-- Internal & Retail
('tsk-022','Update Accel QMS procedures for new delivery framework','Internal Quality Framework','ws-007','Low','In Progress','2026-03-31','AM','Revise 14 quality procedures to reflect updated service delivery framework and incorporate client feedback mechanisms.'),
('tsk-023','Complete LuLu platform RFP and issue to 6 shortlisted vendors','Retail Digital Commerce','ws-008','High','In Progress','2026-04-01','RT','Finalise RFP for omnichannel commerce platform and issue to Shopify Plus, Salesforce Commerce, Oracle CX, Adobe Commerce, SAP CX, and Magento.'),
('tsk-024','Conduct LuLu current-state digital capability assessment','Retail Digital Commerce','ws-008','Medium','Completed','2026-03-10','JL','Assess current digital maturity across online, mobile, loyalty, and in-store channels across UAE, KSA, and Kuwait markets.')
on conflict (id) do nothing;

-- ── Risks ─────────────────────────────────────────────────────
insert into risks (id, title, workspace, workspace_id, probability, impact, severity, status, owner, mitigation, date_identified, category, financial_exposure) values
-- NCA
('rsk-001','Key stakeholder unavailability during Phase 3 pilot rollout','NCA Digital Transformation Program','ws-001',3,4,'High','Open','AM','Escalate to NCA DG for deputy decision-maker appointment; establish decision-by-email protocol; maintain 48-hour decision SLA.','2026-02-15','Governance',420000),
('rsk-002','Data migration quality failures causing go-live delay at pilot agencies','NCA Digital Transformation Program','ws-001',3,5,'Critical','Monitoring','SK','Run parallel data validation cycles; engage specialist data quality tool; extend mock migration schedule from 2 to 4 cycles; daily quality dashboards.','2026-03-01','Technical',840000),
('rsk-003','Scope creep from new NCA executive requirements in Phase 3','NCA Digital Transformation Program','ws-001',4,3,'High','Open','AM','Implement strict change control board; weekly scope freeze confirmation; formal change request process for all additions.','2026-03-05','Scope',315000),
-- ADNOC
('rsk-004','ERP vendor selection delay due to extended evaluation cycles','ADNOC Supply Chain Optimization','ws-002',4,3,'High','Open','RT','Accelerate RFP evaluation timeline; prepare dual-track award scenario; obtain ADNOC CPO pre-approval for expedited process.','2026-02-20','Procurement',350000),
('rsk-005','SAP integration complexity exceeding project budget estimate','ADNOC Supply Chain Optimization','ws-002',3,4,'High','Open','MK','Conduct detailed integration point sizing exercise; negotiate fixed-price cap with SAP implementation partner; identify de-scope options.','2026-03-01','Financial',525000),
-- Smart City
('rsk-006','Smart City Package 3 contractor capacity shortfall and mobilisation delay','Smart City Infrastructure PMO','ws-005',4,5,'Critical','Open','JL','Issue formal change notice; activate backup contractor roster (3 pre-qualified); seek PMO Board emergency approval; weekly capacity monitoring.','2026-02-28','Delivery',2040000),
('rsk-007','Smart City Package 2 budget overrun – AED 320M exposure','Smart City Infrastructure PMO','ws-005',4,4,'High','Open','JL','Implement scope change freeze; commission value engineering study; present options to Municipality ExCo by 07 Apr; apply contract variations protocol.','2026-03-01','Financial',680000),
('rsk-008','Smart City IoT vendor supply chain issues affecting Package 1 delivery','Smart City Infrastructure PMO','ws-005',3,3,'Medium','Monitoring','RT','Expedite purchase orders; source from secondary supplier for critical IoT nodes; pre-position equipment at site storage.','2026-02-10','Supply Chain',180000),
-- Banking
('rsk-009','ENB P1 UAT defects unresolved at go-live cutover date','Banking Core Transformation','ws-006',3,5,'Critical','Monitoring','DN','24/7 defect triage team active; ExCo daily update bridge; contingency: 2-week go-live deferral plan prepared; regression test suite on standby.','2026-03-10','Technical',600000),
('rsk-010','Core banking data cutover exceeding maintenance window','Banking Core Transformation','ws-006',2,5,'High','Open','AS','Conduct two full dress rehearsal cutovers; optimise migration scripts; pre-position DBA team; agree 6-hour extension window with ENB board.','2026-03-08','Technical',480000),
-- Healthcare & Others
('rsk-011','Healthcare EMR preferred vendor financial instability','Healthcare Digital Strategy','ws-004',2,4,'High','Open','SK','Conduct independent financial due diligence; negotiate parent company guarantee; escrow source code agreement; maintain shortlist of backup vendor.','2026-03-05','Vendor',195000),
('rsk-012','MOCI e-procurement platform integration delay with Ministry of Finance','MOCI Procurement Reform','ws-003',2,3,'Medium','Mitigated','FH','Ministry IT teams formally engaged; joint integration test plan approved and signed; phased go-live approach with MoF agreed in writing.','2026-01-20','Technical',80000),
('rsk-013','LuLu RFP timeline compression reducing vendor response quality','Retail Digital Commerce','ws-008',3,3,'Medium','Open','RT','Extended RFP response window from 3 to 5 weeks; bidder Q&A sessions scheduled; pre-qualification shortlist reduces risk of poor-quality bids.','2026-03-06','Procurement',120000)
on conflict (id) do nothing;

-- ── Reports ───────────────────────────────────────────────────
insert into reports (id, title, type, type_color, workspace, workspace_id, date, status, pages, period, author) values
('rpt-001','Portfolio Weekly Status Report – W10 2026','Weekly Status','#0EA5E9','All Workspaces',null,'2026-03-10','Generated',4,'W10 (03–07 Mar 2026)','Consultant OS AI'),
('rpt-002','Portfolio Weekly Status Report – W11 2026','Weekly Status','#0EA5E9','All Workspaces',null,'2026-03-17','Generated',4,'W11 (10–14 Mar 2026)','Consultant OS AI'),
('rpt-003','NCA Digital Transformation – Monthly Report Feb 2026','Monthly Report','#8B5CF6','NCA Digital Transformation Program','ws-001','2026-02-28','Generated',8,'February 2026','Consultant OS AI'),
('rpt-004','Smart City PMO – Board Pack Q1 2026','Board Summary','#EC4899','Smart City Infrastructure PMO','ws-005','2026-03-13','Generated',12,'Q1 2026','Consultant OS AI'),
('rpt-005','Banking Core Transformation – Go-Live Readiness Report','Board Summary','#F59E0B','Banking Core Transformation','ws-006','2026-03-14','Generated',6,'Pre-Go-Live Mar 2026','Consultant OS AI'),
('rpt-006','Portfolio Monthly Report – February 2026','Monthly Report','#8B5CF6','All Workspaces',null,'2026-02-28','Generated',10,'February 2026','Consultant OS AI'),
('rpt-007','MOCI Procurement Reform – Committee Report #8','Weekly Status','#10B981','MOCI Procurement Reform','ws-003','2026-03-11','Generated',5,'W10 2026','Consultant OS AI'),
('rpt-008','Smart City Package 1 – Progress Report W11','Weekly Status','#8B5CF6','Smart City Infrastructure PMO','ws-005','2026-03-17','Generated',3,'W11 2026','Consultant OS AI'),
('rpt-009','Portfolio Risk Dashboard – Q1 2026','Board Summary','#EF4444','All Workspaces',null,'2026-03-13','Generated',7,'Q1 2026','Consultant OS AI'),
('rpt-010','NCA Digital Transformation – Phase 2 Completion Report','Monthly Report','#0EA5E9','NCA Digital Transformation Program','ws-001','2026-03-06','Generated',9,'Phase 2 Closeout','Consultant OS AI')
on conflict (id) do nothing;

-- ── Activities ────────────────────────────────────────────────
insert into activities (id, "user", action, target, workspace, workspace_id, time, type) values
('act-001','AM','Generated','Weekly Status Report W11','All Workspaces',null,'2 hours ago','report'),
('act-002','SK','Uploaded','NCA Data Migration Strategy & Mapping','NCA Digital Transformation Program','ws-001','3 hours ago','document'),
('act-003','DN','Updated','Banking P1 UAT defect BNK-UAT-0247 status to Resolved','Banking Core Transformation','ws-006','4 hours ago','task'),
('act-004','JL','Added milestone','Smart City Package 3 Commencement to Smart City PMO','Smart City Infrastructure PMO','ws-005','5 hours ago','milestone'),
('act-005','FH','Completed meeting','MOCI Procurement Committee Session #8','MOCI Procurement Reform','ws-003','Yesterday','meeting'),
('act-006','MK','Submitted','ADNOC ERP Integration Spec for review','ADNOC Supply Chain Optimization','ws-002','Yesterday','document'),
('act-007','AM','Closed Phase 2','NCA Phase 2 – Enterprise Architecture Delivery milestone','NCA Digital Transformation Program','ws-001','2 days ago','milestone'),
('act-008','RT','Updated risk','Smart City Package 2 budget overrun severity to High','Smart City Infrastructure PMO','ws-005','2 days ago','risk'),
('act-009','AS','Uploaded','ENB UAT Final Test Report','Banking Core Transformation','ws-006','2 days ago','document'),
('act-010','SK','Generated','SEHA Digital Health Strategy 2026–2030 document','Healthcare Digital Strategy','ws-004','3 days ago','document'),
('act-011','AM','Created task','Finalize Phase 3 resource allocation plan','NCA Digital Transformation Program','ws-001','3 days ago','task'),
('act-012','JL','Escalated risk','Smart City Package 3 contractor capacity shortfall to Critical','Smart City Infrastructure PMO','ws-005','3 days ago','risk'),
('act-013','DN','Generated','Banking Go-Live Readiness Report','Banking Core Transformation','ws-006','4 days ago','report'),
('act-014','FH','Approved','MOCI Procurement Framework v2.0','MOCI Procurement Reform','ws-003','4 days ago','document'),
('act-015','AM','Generated','Portfolio Monthly Report February 2026','All Workspaces',null,'5 days ago','report'),
('act-016','RT','Completed','ADNOC Process Design Workshop – Procurement meeting','ADNOC Supply Chain Optimization','ws-002','5 days ago','meeting'),
('act-017','SK','Added','Healthcare EMR vendor financial instability risk','Healthcare Digital Strategy','ws-004','6 days ago','risk'),
('act-018','JL','Updated','Smart City PMO Charter to v1.2','Smart City Infrastructure PMO','ws-005','1 week ago','document'),
('act-019','AS','Completed','ENB UAT Final Signoff meeting','Banking Core Transformation','ws-006','1 week ago','meeting'),
('act-020','AM','Completed','NCA Phase 2 Closeout Meeting with steering committee','NCA Digital Transformation Program','ws-001','1 week ago','meeting')
on conflict (id) do nothing;
