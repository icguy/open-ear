import {
  Component,
} from '@angular/core';
import { ExerciseStateService } from './state/exercise-state.service';
import {
  ModalController,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { ExerciseSettingsPage } from './components/exercise-settings.page/exercise-settings.page';
import * as _ from 'lodash';
import { ExerciseExplanationService } from './state/exercise-explanation.service';
import { Exercise } from '../Exercise';
import AnswerConfig = Exercise.AnswerConfig;
import { BaseComponent } from '../../shared/ts-utility';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-exercise-page',
  templateUrl: './exercise.page.html',
  styleUrls: ['./exercise.page.scss'],
  providers: [
    ExerciseStateService,
    ExerciseExplanationService,
  ],
})
export class ExercisePage extends BaseComponent {
  wrongAnswers: string[] = [];
  rightAnswer: string | null = null;
  isMenuOpened: boolean = false;

  get isQuestionCompleted(): boolean {
    return !!this.state.currentAnswers[this.state.currentAnswers.length - 1]?.answer;
  }

  get correctAnswersPercentage(): number {
    if (!this.state.totalQuestions) {
      return 0;
    }
    return (this.state.totalCorrectAnswers / this.state.totalQuestions) * 100;
  }

  constructor(
    public state: ExerciseStateService,
    public exerciseExplanation: ExerciseExplanationService,
    private _modalController: ModalController,
    private _alertController: AlertController,
    private _toastController: ToastController,
  ) {
    super();
    this._init();
    this._handleMessages();
  }

  onAnswerClick(answerConfig: AnswerConfig<string>): void {

    if (this.isQuestionCompleted) {
      this.state.playAnswer(answerConfig);
      return;
    }
    const answer: string | null = answerConfig.answer;

    if (!answer) {
      throw new Error(`Clicked answer is ${answer}`)
    }
    const isRight: boolean = this.state.answer(answer);
    if (isRight) {
      this.rightAnswer = answer;
      this.wrongAnswers = [];
    } else {
      this.wrongAnswers.push(answer);
    }
    setTimeout(() => {
      if (this.state.globalSettings.revealAnswerAfterFirstMistake) {
        this.wrongAnswers = [];
      }
      this.rightAnswer = null;
    }, 100);
  }

  async editSettings(): Promise<void> {
    const allAvailableAnswers: string[] = typeof this.state.answerList === 'object' ? _.flatMap(this.state.answerList) : this.state.answerList;
    const modal = await this._modalController.create({
      component: ExerciseSettingsPage,
      componentProps: {
        exerciseName: this.state.name,
        currentGlobalSettings: this.state.globalSettings,
        exerciseSettingsDescriptorInput: this.state.exerciseSettingsDescriptor, // must be before currentExerciseSettings
        currentExerciseSettings: this.state.exerciseSettings,
        allAvailableAnswers: allAvailableAnswers,
        getAnswerDisplay: (answer: string | null): string | null => this.state.getAnswerDisplay(answer),
      },
    });
    await modal.present();
    this.state.updateSettings((await modal.onDidDismiss()).data);
  }

  private async _init(): Promise<void> {
    await this.exerciseExplanation.init();
    await this.state.init()
  }

  async resetStatistics(): Promise<void> {
    const alert: HTMLIonAlertElement = await this._alertController.create({
      header: 'Reset statistics',
      message: 'Are you sure you want to reset statistics?',
      buttons: [{
        text: 'Cancel',
        role: 'cancel',
      }, {
        text: 'Reset',
        role: 'reset',
      }],
    });
    await alert.present()
    const {role} = await alert.onDidDismiss();
    if (role === 'reset') {
      this.state.resetStatistics();
    }
  }

  private _handleMessages(): void {
    let lastToaster: HTMLIonToastElement | null = null;
    this.state.message$
      .pipe(
        takeUntil(this._destroy$),
      )
      .subscribe(message => {
        if (lastToaster) {
          lastToaster.dismiss();
          lastToaster = null;
        }

        if (!message) {
          return;
        }

        this._toastController.create({
          message: message,
          position: 'middle',
        }).then(toaster => {
          // can happen because of a race condition
          if (lastToaster) {
            lastToaster.dismiss();
          }
          lastToaster = toaster;
          toaster.present();
        })
      })
  }
}
