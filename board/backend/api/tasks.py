from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import ProjectTask, Project
from schemas.core import TaskCreate, TaskResponse

router = APIRouter(
    prefix="/api/tasks",
    tags=["Tasks"]
)

@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    """
    Create a new task linked to a project.
    """
    # Verify the project exists first
    project = db.query(Project).filter(Project.project_id == task_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_task = ProjectTask(**task_in.model_dump())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.get("/", response_model=List[TaskResponse])
def get_all_tasks(db: Session = Depends(get_db)):
    """
    Fetch all tasks across all projects (useful for a global 'To-Do' list).
    """
    return db.query(ProjectTask).all()

@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: UUID, db: Session = Depends(get_db)):
    """
    Delete a specific task.
    """
    task = db.query(ProjectTask).filter(ProjectTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(task)
    db.commit()
    return None