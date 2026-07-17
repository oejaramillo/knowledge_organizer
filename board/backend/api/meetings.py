from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import ProjectMeeting, Project, Contributor
from schemas.core import MeetingCreate, MeetingResponse

router = APIRouter(
    prefix="/api/meetings", 
    tags=["Meetings"]
)

@router.post("/", response_model=MeetingResponse, status_code=201)
def create_meeting(meeting_in: MeetingCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == meeting_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = meeting_in.model_dump(exclude={"participant_ids"})
    new_meeting = ProjectMeeting(**data)

    if meeting_in.participant_ids:
        contributors = db.query(Contributor).filter(
            Contributor.contributor_id.in_(meeting_in.participant_ids)
        ).all()
        new_meeting.participants = contributors

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    return new_meeting

@router.get("/", response_model=List[MeetingResponse])
def get_all_meetings(db: Session = Depends(get_db)):
    return db.query(ProjectMeeting).all()

@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: UUID, db: Session = Depends(get_db)):
    meeting = db.query(ProjectMeeting).filter(ProjectMeeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: UUID, db: Session = Depends(get_db)):
    meeting = db.query(ProjectMeeting).filter(ProjectMeeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    return None