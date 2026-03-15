-- ============================================================
-- CONSULTANT OS – Seed Data
-- Run AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- ── Workspaces ───────────────────────────────────────────────
insert into workspaces (id, name, client, sector, sector_color, type, language, progress, status, docs_count, meetings_count, tasks_count, contributors, last_activity, description) values
('ws-001','NCA Digital Transformation Program','National Communications Authority','Government','#0EA5E9','Client','Bilingual',68,'Active',124,38,47,'{"AM","SK","RT","JL"}','2 hours ago','End-to-end digital transformation initiative covering enterprise architecture, process automation, and citizen service delivery modernization.'),
('ws-002','ADNOC Supply Chain Optimization','Abu Dhabi National Oil Company','Energy','#F59E0B','Client','EN',45,'Active',89,22,31,'{"MK","AS","DN"}','5 hours ago','Supply chain process re-engineering and ERP integration for upstream and midstream operations.'),
('ws-003','MOCI Procurement Reform','Ministry of Commerce & Industry','Government','#0EA5E9','Procurement',  'Bilingual',82,'Active',156,45,28,'{"FH","AM","SK"}','1 hour ago','Comprehensive procurement framework overhaul aligned with national procurement law and e-procurement platform rollout.'),
('ws-004','Healthcare Digital Strategy','Abu Dhabi Health Services','Healthcare','#10B981','Client','EN',30,'Active',67,18,22,'{"SK","DN"}','Yesterday','Digital health transformation strategy covering EMR integration, telemedicine, and patient experience platforms.'),
('ws-005','Smart City Infrastructure PMO','Abu Dhabi City Municipality','Infrastructure','#8B5CF6','Project','Bilingual',55,'Active',203,61,89,'{"JL","RT","AM","MK","FH"}','3 hours ago','Program management office for AED 6.8B smart city infrastructure program across 12 concurrent workstreams.'),
('ws-006','Banking Core Transformation','Emirates National Bank','Financial Services','#F59E0B','Client','EN',91,'Active',312,87,14,'{"DN","AS"}','4 hours ago','Core banking system migration and digital channel modernization program approaching final go-live phase.'),
('ws-007','Internal Quality Framework','Accel Consulting (Internal)','Internal','#94A3B8','Internal','EN',75,'Active',44,12,19,'{"AM","SK"}','Yesterday','Internal ISO 9001 quality management framework implementation and continuous improvement program.'),
('ws-008','Retail Digital Commerce','LuLu Hypermarket Group','Retail','#EC4899','Client','Bilingual',22,'Active',31,8,15,'{"RT","JL"}','2 days ago','Omnichannel digital commerce platform and loyalty program for regional retail expansion.')
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
  contract_value = excluded.contract_value, spent = excluded.spent, forecast = excluded.forecast,
  variance = excluded.variance, billing_model = excluded.billing_model,
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
('ms-001','ws-001','Phase 1: Requirements Finalization','15 Jan 2026','Completed',840000,'AM',100),
('ms-002','ws-001','Phase 2: Architecture Design Delivery','28 Feb 2026','Completed',1050000,'AM',100),
('ms-003','ws-001','Phase 3: Pilot Implementation','15 Apr 2026','On Track',1260000,'SK',62),
('ms-004','ws-001','Phase 4: Full Rollout & Go-Live','30 Jun 2026','Upcoming',1050000,'AM',0),
('ms-005','ws-003','ENB Core Banking Go-Live','01 Apr 2026','On Track',1120000,'DN',91),
('ms-006','ws-003','UAT Signoff & User Training','15 Mar 2026','At Risk',560000,'DN',75),
('ms-007','ws-005','Smart City Package 1 Delivery','31 Mar 2026','On Track',2040000,'JL',78),
('ms-008','ws-005','Smart City Package 3 Commencement','01 May 2026','At Risk',1360000,'JL',15),
('ms-009','ws-002','Supply Chain Process Design','30 Apr 2026','On Track',1050000,'RT',45),
('ms-010','ws-004','Q1 Procurement Advisory Retainer','31 Mar 2026','Completed',487500,'FH',100)
on conflict (id) do update set
  title = excluded.title, due_date = excluded.due_date, status = excluded.status,
  value = excluded.value, owner = excluded.owner, completion_pct = excluded.completion_pct,
  updated_at = now();

-- ── Documents (sample per workspace) ────────────────────────
insert into documents (id, name, type, type_color, workspace, workspace_id, date, language, status, size, author, pages, summary, tags) values
('doc-001','NCA Digital Transformation – BRD v3.2','BRD','#0EA5E9','NCA Digital Transformation Program','ws-001','2026-03-10','Bilingual','Approved','2.4 MB','Ahmed Al-Mahmoud',87,'Comprehensive business requirements document covering all 14 digital transformation workstreams.','{"requirements","transformation","approved"}'),
('doc-002','NCA Enterprise Architecture Blueprint','Architecture','#8B5CF6','NCA Digital Transformation Program','ws-001','2026-02-28','EN','Final','5.1 MB','Sara Khalid',124,'Target enterprise architecture including integration layer, cloud strategy, and security framework.','{"architecture","blueprint","final"}'),
('doc-003','NCA Phase 3 Implementation Plan','Project Plan','#10B981','NCA Digital Transformation Program','ws-001','2026-03-05','EN','Under Review','1.8 MB','Raj Thomas',45,'Detailed implementation plan for Phase 3 pilot covering 3 pilot agencies and rollout schedule.','{"implementation","phase3"}'),
('doc-004','ADNOC Supply Chain As-Is Assessment','Assessment','#F59E0B','ADNOC Supply Chain Optimization','ws-002','2026-02-15','EN','Approved','3.2 MB','Mohammed Khalid',67,'Current-state assessment of supply chain operations across upstream, midstream, and downstream.','{"assessment","supply-chain"}'),
('doc-005','ADNOC ERP Integration Specification','Technical Spec','#0EA5E9','ADNOC Supply Chain Optimization','ws-002','2026-03-01','EN','Draft','1.9 MB','Ahmed Salem',38,'Technical specification for SAP S/4HANA integration with existing ADNOC systems.','{"ERP","SAP","integration"}'),
('doc-006','MOCI Procurement Framework v2.0','Policy','#10B981','MOCI Procurement Reform','ws-003','2026-03-08','Bilingual','Approved','4.7 MB','Fatima Hassan',156,'Updated procurement policy framework aligned with Federal Procurement Law No. 12/2025.','{"policy","procurement","approved"}'),
('doc-007','Smart City PMO Charter','Charter','#8B5CF6','Smart City Infrastructure PMO','ws-005','2026-01-15','Bilingual','Final','0.9 MB','James Lee',22,'Program charter defining governance, reporting structure, and success criteria for Smart City program.','{"charter","PMO","governance"}'),
('doc-008','Banking Core Migration Runbook','Technical','#F59E0B','Banking Core Transformation','ws-006','2026-03-12','EN','Approved','8.3 MB','David Ng',203,'Detailed migration runbook for core banking cutover scheduled for 01 Apr 2026.','{"migration","runbook","banking"}')
on conflict (id) do nothing;

-- ── Meetings (sample per workspace) ─────────────────────────
insert into meetings (id, title, date, time, duration, type, status, participants, workspace, workspace_id, minutes_generated, actions_extracted, decisions_logged, location, quorum_status) values
('mtg-001','NCA Phase 3 Steering Committee','2026-03-20','10:00','2h','Steering','Upcoming','{"AM","SK","RT","NCA-CEO","NCA-CTO"}','NCA Digital Transformation Program','ws-001',false,0,0,'NCA HQ – Boardroom A','Met'),
('mtg-002','NCA Weekly PMO Standup','2026-03-15','09:00','45m','Standup','Upcoming','{"AM","SK","RT","JL"}','NCA Digital Transformation Program','ws-001',false,0,0,'Virtual – Teams',null),
('mtg-003','NCA Architecture Review Workshop','2026-03-08','13:00','3h','Workshop','Completed','{"AM","SK","RT"}','NCA Digital Transformation Program','ws-001',true,8,3,'NCA HQ – Room 201','Met'),
('mtg-004','ADNOC ERP Vendor Evaluation','2026-03-18','11:00','2h','Review','Upcoming','{"MK","AS","ADNOC-CPO"}','ADNOC Supply Chain Optimization','ws-002',false,0,0,'ADNOC Tower','Met'),
('mtg-005','Smart City Package 1 Progress Review','2026-03-17','14:00','1.5h','Review','Upcoming','{"JL","RT","AM","Municipality-PM"}','Smart City Infrastructure PMO','ws-005',false,0,0,'Municipality HQ','Met'),
('mtg-006','Banking Go-Live Readiness Review','2026-03-14','09:00','2h','Review','Completed','{"DN","AS","ENB-CTO","ENB-COO"}','Banking Core Transformation','ws-006',true,5,2,'ENB Head Office','Met'),
('mtg-007','MOCI Procurement Committee Session','2026-03-11','10:00','2h','Committee','Completed','{"FH","AM","MOCI-DG","MOCI-CFO"}','MOCI Procurement Reform','ws-003',true,6,4,'MOCI HQ','Met'),
('mtg-008','Healthcare Strategy Workshop','2026-03-25','09:00','4h','Workshop','Upcoming','{"SK","DN","SEHA-CEO","MOH-ADG"}','Healthcare Digital Strategy','ws-004',false,0,0,'SEHA Boardroom',null)
on conflict (id) do nothing;

-- ── Tasks (sample per workspace) ─────────────────────────────
insert into tasks (id, title, workspace, workspace_id, priority, status, due_date, assignee, description) values
('tsk-001','Finalize Phase 3 resource allocation plan','NCA Digital Transformation Program','ws-001','High','In Progress','2026-03-20','AM','Confirm staffing for the 3 pilot agencies and assign leads for each workstream.'),
('tsk-002','Complete NCA data migration mapping','NCA Digital Transformation Program','ws-001','High','In Progress','2026-03-25','SK','Map all legacy data fields to target schema for 14 integrated systems.'),
('tsk-003','Draft NCA stakeholder communication plan','NCA Digital Transformation Program','ws-001','Medium','Backlog','2026-04-01','RT','Prepare communication plan for Phase 3 go-live covering all 3 pilot agencies.'),
('tsk-004','Submit ADNOC ERP integration spec for review','ADNOC Supply Chain Optimization','ws-002','High','In Review','2026-03-18','MK','Submit technical specification document to ADNOC IT team for sign-off.'),
('tsk-005','Coordinate ADNOC vendor demo sessions','ADNOC Supply Chain Optimization','ws-002','Medium','In Progress','2026-03-22','AS','Schedule and facilitate SAP S/4HANA demo sessions with 3 shortlisted vendors.'),
('tsk-006','Update MOCI procurement policy manual','MOCI Procurement Reform','ws-003','High','Completed','2026-03-10','FH','Incorporate legal review comments into Procurement Framework v2.0.'),
('tsk-007','Prepare Smart City Package 1 handover docs','Smart City Infrastructure PMO','ws-005','High','In Progress','2026-03-28','JL','Compile all deliverable handover documentation for Package 1 milestone.'),
('tsk-008','Banking UAT defect resolution – P1 items','Banking Core Transformation','ws-006','High','Overdue','2026-03-12','DN','Resolve 3 remaining P1 defects from UAT phase before go-live clearance.'),
('tsk-009','Healthcare vendor shortlist evaluation','Healthcare Digital Strategy','ws-004','Medium','Backlog','2026-04-10','SK','Evaluate 5 shortlisted EMR vendors against technical and commercial criteria.'),
('tsk-010','Internal QMS documentation update','Accel Consulting (Internal)','ws-007','Low','In Progress','2026-03-31','AM','Update quality management system documentation to reflect new service delivery processes.')
on conflict (id) do nothing;

-- ── Risks (sample per workspace) ─────────────────────────────
insert into risks (id, title, workspace, workspace_id, probability, impact, severity, status, owner, mitigation, date_identified, category, financial_exposure) values
('rsk-001','Key stakeholder unavailability during Phase 3 rollout','NCA Digital Transformation Program','ws-001',3,4,'High','Open','AM','Escalate to NCA DG; identify deputy decision-makers; establish decision-by-email protocol.','2026-02-15','Governance',420000),
('rsk-002','Data migration quality issues causing go-live delay','NCA Digital Transformation Program','ws-001',3,5,'Critical','Monitoring','SK','Run parallel data validation; engage data quality specialist; extend mock migration cycles.','2026-03-01','Technical',840000),
('rsk-003','ADNOC ERP vendor selection delay','ADNOC Supply Chain Optimization','ws-002',4,3,'High','Open','RT','Accelerate RFP evaluation; prepare dual-track award scenario; obtain ADNOC CPO approval.','2026-02-20','Procurement',350000),
('rsk-004','Smart City Package 3 contractor capacity shortfall','Smart City Infrastructure PMO','ws-005',4,5,'Critical','Open','JL','Issue urgent contractor change notice; activate backup contractor roster; seek PMO Board approval.','2026-02-28','Delivery',2040000),
('rsk-005','Banking go-live UAT P1 defects unresolved','Banking Core Transformation','ws-006',3,5,'Critical','Monitoring','DN','24/7 defect triage team; daily ExCo update; contingency: defer go-live by 2 weeks.','2026-03-10','Technical',600000),
('rsk-006','MOCI procurement system integration delay','MOCI Procurement Reform','ws-003',2,3,'Medium','Mitigated','FH','Ministry IT team engaged; integration test plan approved; phased go-live approach agreed.','2026-01-20','Technical',80000),
('rsk-007','Healthcare EMR vendor financial instability','Healthcare Digital Strategy','ws-004',2,4,'High','Open','SK','Conduct vendor financial due diligence; negotiate contractual protections; identify backup vendor.','2026-03-05','Vendor',195000),
('rsk-008','Smart City budget overrun on Package 2','Smart City Infrastructure PMO','ws-005',4,4,'High','Open','JL','Implement change control freeze; review scope with Municipality; apply value engineering.','2026-03-01','Financial',680000)
on conflict (id) do nothing;
